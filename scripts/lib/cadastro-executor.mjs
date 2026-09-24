import { readFile } from 'node:fs/promises'

const BUCKET = 'arquivos'
const PRIVATE_BUCKET = 'arquivos-restritos'
const effectiveOffers = plano => plano.ofertas ?? [{ codigo: plano.ficha.id, nivel: 'complete', nome: plano.ficha.nome }]

function ownPublicFile(url, supabaseUrl) {
  if (typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    if (parsed.origin !== new URL(supabaseUrl).origin) return false
    const prefix = '/storage/v1/object/public/arquivos/'
    if (parsed.pathname.startsWith(prefix)) return true
    return decodeURIComponent(parsed.pathname).startsWith(prefix)
  } catch {
    return false
  }
}

function preflightCompleteFiles(db, plano, currentModules, currentItems) {
  function checkItem(item) {
    if (item.arquivo ? (item.arquivo.bucket ?? BUCKET) === BUCKET : ownPublicFile(item.url, db.supabaseUrl)) {
      throw new Error(`Item ${item.title} usa arquivo público próprio em módulo Completo; reenvie para o bucket privado antes de cadastrar.`)
    }
  }
  for (const modulo of plano.modulos) {
    if (modulo.requiredLevel !== 'complete') continue
    const existing = currentModules.find(row => row.title === modulo.title)
    for (const item of modulo.itens) checkItem(item)
    for (const item of currentItems.filter(row => row.module_id === existing?.id && !modulo.itens.some(incoming => incoming.title === row.title))) checkItem(item)
  }
  for (const modulo of currentModules.filter(row => row.required_level === 'complete' && !plano.modulos.some(incoming => incoming.title === row.title))) {
    for (const item of currentItems.filter(row => row.module_id === modulo.id)) checkItem(item)
  }
}

async function rows(db, table, columns = '*', filters = {}) {
  const all = []
  const pageSize = 1000
  for (let start = 0; ;) {
    let query = db.from(table).select(columns)
    for (const [field, value] of Object.entries(filters)) query = query.eq(field, value)
    query = table === 'offer_products' ? query.order('offer_id').order('product_id') : query.order('id')
    const { data, error } = await query.range(start, start + pageSize - 1)
    if (error) throw new Error(`Falha na consulta de ${table}. Confira o esquema, as permissões e a conexão.`)
    if (!Array.isArray(data)) throw new Error(`Resposta inválida na consulta de ${table}.`)
    all.push(...data)
    if (!data.length) return all
    start += data.length
  }
}

async function write(query, label, returning = false) {
  const result = returning ? await query.select('id').single() : await query
  if (result.error) throw new Error(`Falha ao gravar ${label}. Corrija a causa e reexecute o cadastro para retomar.`)
  if (returning && !result.data?.id) throw new Error(`Resposta inválida ao gravar ${label}.`)
  return result.data
}

export function validarLote(planos) {
  if (!Array.isArray(planos) || !planos.length) throw new Error('Nenhum plano de produto para cadastrar.')
  const keys = new Set(), codes = new Set(), slugs = new Map()
  for (const plano of planos) {
    const ficha = plano?.ficha
    if (!ficha?.loja || !ficha.slug || !Array.isArray(plano.arquivos) || !Array.isArray(plano.modulos)) throw new Error('Plano de produto inválido.')
    const offers = effectiveOffers(plano)
    if (!Array.isArray(offers) || !offers.length || offers.some(offer => !offer?.codigo || !['basic', 'complete'].includes(offer.nivel) || !offer.nome)) throw new Error('Ofertas do plano inválidas.')
    if (plano.modulos.some(modulo => modulo.requiredLevel && !['basic', 'complete'].includes(modulo.requiredLevel))) throw new Error('Nível de módulo inválido.')
    for (const file of plano.arquivos) {
      const bucket = file.bucket ?? BUCKET
      if (![BUCKET, PRIVATE_BUCKET].includes(bucket)) throw new Error(`Bucket inválido para ${file.relativePath}.`)
      if (ficha.modoNiveis && file.relativePath.startsWith('entregaveis/') && bucket !== PRIVATE_BUCKET) throw new Error(`Entregável ${file.relativePath} deve usar bucket privado.`)
    }
    const key = `${ficha.loja}/${ficha.slug}`
    if (keys.has(key)) throw new Error(`Produto repetido no lote: ${key}.`)
    for (const offer of offers) {
      if (codes.has(offer.codigo)) throw new Error(`Código Payt repetido no lote: ${offer.codigo}.`)
      codes.add(offer.codigo)
    }
    if (slugs.has(ficha.slug) && slugs.get(ficha.slug) !== ficha.loja) throw new Error(`Slug ${ficha.slug} usado por lojas diferentes no lote; storage compartilhado.`)
    keys.add(key); slugs.set(ficha.slug, ficha.loja)
  }
}

async function preflight(db, planos) {
  validarLote(planos)
  const prepared = []
  for (const plano of planos) {
    const { ficha } = plano
    // Consultas filtradas evitam o limite padrão de linhas do PostgREST.
    // Consultar role detecta migration ausente mesmo quando o slug não existe.
    const [stores, sameSlug, ...offerRows] = await Promise.all([
      rows(db, 'stores', 'id,slug', { slug: ficha.loja }),
      rows(db, 'products', 'id,store_id,slug,role,upgrade_checkout_url', { slug: ficha.slug }),
      ...effectiveOffers(plano).map(offer => rows(db, 'offers', 'id,store_id,payt_product_code', { payt_product_code: offer.codigo })),
    ])
    const store = stores.find(row => row.slug === ficha.loja)
    if (!store) throw new Error(`Loja não encontrada: ${ficha.loja}.`)
    if (sameSlug.some(row => row.store_id !== store.id)) throw new Error(`Slug ${ficha.slug} já pertence a outra loja; o storage seria compartilhado.`)
    const product = sameSlug.find(row => row.store_id === store.id) ?? null
    const offers = effectiveOffers(plano).map((spec, index) => ({ spec, existing: offerRows[index].find(row => row.payt_product_code === spec.codigo) ?? null }))
    const links = (await Promise.all(offers.map(({ existing }) => rows(db, 'offer_products', 'offer_id,product_id,grant_level', { offer_id: existing?.id ?? '00000000-0000-0000-0000-000000000000' })))).flat()
    const modules = await rows(db, 'modules', 'id,product_id,title,sort_order,is_published,required_level', { product_id: product?.id ?? '00000000-0000-0000-0000-000000000000' })
    const items = []
    for (const entry of modules.length ? modules : [{ id: '00000000-0000-0000-0000-000000000000' }]) {
      items.push(...await rows(db, 'items', 'id,module_id,title,kind,url,sort_order,is_published', { module_id: entry.id }))
    }
    if (product) {
      for (const modulo of plano.modulos) {
        const matching = modules.filter(row => row.product_id === product.id && row.title === modulo.title)
        if (matching.length > 1) throw new Error(`Módulo duplicado no banco: ${modulo.title}. Corrija antes de cadastrar.`)
        if (matching.length) for (const item of modulo.itens) {
          if (items.filter(row => row.module_id === matching[0].id && row.title === item.title).length > 1) {
            throw new Error(`Item duplicado no banco: ${item.title}. Corrija antes de cadastrar.`)
          }
        }
      }
    }
    preflightCompleteFiles(db, plano, modules, items)
    for (const { spec, existing } of offers) {
      if (existing && existing.store_id !== store.id) throw new Error(`Código Payt ${spec.codigo} já pertence a outra loja.`)
      if (existing && links.some(row => row.offer_id === existing.id && row.product_id !== product?.id)) {
        throw new Error(`Oferta Payt ${spec.codigo} já libera outro produto; vínculo preservado.`)
      }
    }
    prepared.push({ plano, store, product, offers, modules, items, links, bytes: new Map() })
  }
  // Ler todo o lote antes da primeira mutação: uma falha na segunda pasta não envia a primeira.
  for (const entry of prepared) {
    for (const file of entry.plano.arquivos) {
      let bytes
      try { bytes = await readFile(file.absolutePath) } catch { throw new Error(`Falha de leitura do arquivo ${file.relativePath}. Nenhum produto foi enviado.`) }
      if (bytes.length !== file.size) throw new Error(`Arquivo ${file.relativePath} mudou de tamanho. Leia a pasta novamente.`)
      entry.bytes.set(file, bytes)
    }
  }
  return prepared
}

function publicUrl(db, file) {
  const url = db.storage.from(BUCKET).getPublicUrl(file.storagePath)?.data?.publicUrl
  if (!url) throw new Error(`Falha ao obter URL pública de ${file.relativePath}.`)
  const resolved = new URL(url)
  resolved.searchParams.set('download', file.downloadName)
  return resolved.toString()
}

function privateUrl(db, file) {
  const origin = new URL(db.supabaseUrl)
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/') throw new Error('Origem Supabase inválida para arquivo privado.')
  const path = file.storagePath.split('/').map(encodeURIComponent).join('/')
  const url = new URL(`/storage/v1/object/authenticated/${PRIVATE_BUCKET}/${path}`, origin)
  return url.toString()
}

async function upload(db, entry) {
  const urls = new Map()
  for (const file of entry.plano.arquivos) {
    const bucket = file.bucket ?? BUCKET
    if (![BUCKET, PRIVATE_BUCKET].includes(bucket)) throw new Error(`Bucket inválido para ${file.relativePath}.`)
    const { error } = await db.storage.from(bucket).upload(file.storagePath, entry.bytes.get(file), { upsert: true, contentType: file.contentType })
    if (error) throw new Error(`Falha no upload de ${file.relativePath}. Reexecute para retomar.`)
    urls.set(file, bucket === PRIVATE_BUCKET ? privateUrl(db, file) : publicUrl(db, file))
  }
  return urls
}

async function content(db, productId, plano, urls, currentModules, currentItems, log) {
  for (const modulo of plano.modulos) {
    const data = { product_id: productId, title: modulo.title, sort_order: modulo.sortOrder, required_level: modulo.requiredLevel ?? 'basic', is_published: true }
    const found = currentModules.find(row => row.product_id === productId && row.title === modulo.title)
    const moduleId = found
      ? (await write(db.from('modules').update(data).eq('id', found.id), `módulo ${modulo.title}`), found.id)
      : (await write(db.from('modules').insert(data), `módulo ${modulo.title}`, true)).id
    for (const item of modulo.itens) {
      const itemUrl = item.arquivo ? urls.get(item.arquivo) : item.url
      if (!itemUrl) throw new Error(`URL ausente para o item ${item.title}.`)
      const itemData = { module_id: moduleId, title: item.title, kind: item.kind, url: itemUrl, sort_order: item.sortOrder, is_published: true }
      const existing = currentItems.find(row => row.module_id === moduleId && row.title === item.title)
      if (existing) await write(db.from('items').update(itemData).eq('id', existing.id), `item ${item.title}`)
      else await write(db.from('items').insert(itemData), `item ${item.title}`)
    }
    for (const extra of currentItems.filter(row => row.module_id === moduleId && !modulo.itens.some(item => item.title === row.title))) log(`Item extra preservado: ${extra.title}`)
  }
  for (const extra of currentModules.filter(row => row.product_id === productId && !plano.modulos.some(module => module.title === row.title))) {
    log(`Módulo extra preservado: ${extra.title}`)
    for (const child of currentItems.filter(row => row.module_id === extra.id)) log(`Item extra preservado em ${extra.title}: ${child.title}`)
  }
}

export async function executarPlanos(db, planos, { log = console.log } = {}) {
  const entries = await preflight(db, planos)
  const results = []
  for (const entry of entries) {
    const { plano, store, product, offers } = entry
    const urls = await upload(db, entry)
    const { ficha } = plano
    const data = {
      store_id: store.id, slug: ficha.slug, title: ficha.nome, description: ficha.descricao,
      track: ficha.trilha, checkout_url: ficha.checkout, upgrade_checkout_url: ficha.checkoutUpgrade ?? null, role: ficha.tag,
      is_featured: ficha.destaque, sort_order: ficha.ordem, is_published: true,
      cover_url: plano.imagens.capa ? urls.get(plano.imagens.capa) : null,
      banner_url: plano.imagens.banner ? urls.get(plano.imagens.banner) : null,
    }
    const productId = product
      ? (await write(db.from('products').update(data).eq('id', product.id), `produto ${ficha.nome}`), product.id)
      : (await write(db.from('products').insert(data), `produto ${ficha.nome}`, true)).id
    log(`Produto ${product ? 'atualizado' : 'criado'}: ${ficha.nome}`)
    await content(db, productId, plano, urls, entry.modules, entry.items, log)
    const offerIds = []
    for (const { spec, existing } of offers) {
      const offerId = existing
        ? (await write(db.from('offers').update({ name: spec.nome }).eq('id', existing.id), `oferta ${spec.codigo}`), existing.id)
        : (await write(db.from('offers').insert({ store_id: store.id, name: spec.nome, payt_product_code: spec.codigo }), `oferta ${spec.codigo}`, true)).id
      const link = entry.links.find(row => row.offer_id === offerId && row.product_id === productId)
      if (link) await write(db.from('offer_products').update({ grant_level: spec.nivel }).eq('offer_id', offerId).eq('product_id', productId), `vínculo da oferta ${spec.codigo}`)
      else await write(db.from('offer_products').insert({ offer_id: offerId, product_id: productId, grant_level: spec.nivel }), `vínculo da oferta ${spec.codigo}`)
      log(`Oferta Payt ${spec.codigo} (${spec.nivel}) vinculada; link: /${ficha.loja}/produto/${ficha.slug}`)
      offerIds.push(offerId)
    }
    results.push({ productId, offerId: offerIds[0], offerIds, status: product ? 'atualizado' : 'criado' })
  }
  return results
}
