import { readFile } from 'node:fs/promises'

const BUCKET = 'arquivos'

async function rows(db, table, columns = '*', filters = {}) {
  let query = db.from(table).select(columns)
  for (const [field, value] of Object.entries(filters)) query = query.eq(field, value)
  const { data, error } = await query
  if (error) throw new Error(`Falha na consulta de ${table}. Confira o esquema, as permissões e a conexão.`)
  if (!Array.isArray(data)) throw new Error(`Resposta inválida na consulta de ${table}.`)
  return data
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
    if (!ficha?.loja || !ficha.slug || !ficha.id || !Array.isArray(plano.arquivos) || !Array.isArray(plano.modulos)) throw new Error('Plano de produto inválido.')
    const key = `${ficha.loja}/${ficha.slug}`
    if (keys.has(key)) throw new Error(`Produto repetido no lote: ${key}.`)
    if (codes.has(ficha.id)) throw new Error(`Código Payt repetido no lote: ${ficha.id}.`)
    if (slugs.has(ficha.slug) && slugs.get(ficha.slug) !== ficha.loja) throw new Error(`Slug ${ficha.slug} usado por lojas diferentes no lote; storage compartilhado.`)
    keys.add(key); codes.add(ficha.id); slugs.set(ficha.slug, ficha.loja)
  }
}

async function preflight(db, planos) {
  validarLote(planos)
  const prepared = []
  for (const plano of planos) {
    const { ficha } = plano
    // Consultas filtradas evitam o limite padrão de linhas do PostgREST.
    // Consultar role detecta migration ausente mesmo quando o slug não existe.
    const [stores, sameSlug, offers] = await Promise.all([
      rows(db, 'stores', 'id,slug', { slug: ficha.loja }),
      rows(db, 'products', 'id,store_id,slug,role', { slug: ficha.slug }),
      rows(db, 'offers', 'id,store_id,payt_product_code', { payt_product_code: ficha.id }),
    ])
    const store = stores.find(row => row.slug === ficha.loja)
    if (!store) throw new Error(`Loja não encontrada: ${ficha.loja}.`)
    if (sameSlug.some(row => row.store_id !== store.id)) throw new Error(`Slug ${ficha.slug} já pertence a outra loja; o storage seria compartilhado.`)
    const product = sameSlug.find(row => row.store_id === store.id) ?? null
    const offer = offers.find(row => row.payt_product_code === ficha.id) ?? null
    const links = await rows(db, 'offer_products', 'offer_id,product_id', { offer_id: offer?.id ?? '00000000-0000-0000-0000-000000000000' })
    const modules = await rows(db, 'modules', 'id,product_id,title,sort_order,is_published', { product_id: product?.id ?? '00000000-0000-0000-0000-000000000000' })
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
    if (offer && offer.store_id !== store.id) throw new Error(`Código Payt ${ficha.id} já pertence a outra loja.`)
    if (offer && links.some(row => row.offer_id === offer.id && row.product_id !== product?.id)) {
      throw new Error(`Oferta Payt ${ficha.id} já libera outro produto; vínculo preservado.`)
    }
    prepared.push({ plano, store, product, offer, modules, items, links, bytes: new Map() })
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

async function upload(db, entry) {
  const urls = new Map()
  for (const file of entry.plano.arquivos) {
    const { error } = await db.storage.from(BUCKET).upload(file.storagePath, entry.bytes.get(file), { upsert: true, contentType: file.contentType })
    if (error) throw new Error(`Falha no upload de ${file.relativePath}. Reexecute para retomar.`)
    urls.set(file, publicUrl(db, file))
  }
  return urls
}

async function content(db, productId, plano, urls, currentModules, currentItems, log) {
  for (const modulo of plano.modulos) {
    const data = { product_id: productId, title: modulo.title, sort_order: modulo.sortOrder, is_published: true }
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
  for (const extra of currentModules.filter(row => row.product_id === productId && !plano.modulos.some(module => module.title === row.title))) log(`Módulo extra preservado: ${extra.title}`)
}

export async function executarPlanos(db, planos, { log = console.log } = {}) {
  const entries = await preflight(db, planos)
  const results = []
  for (const entry of entries) {
    const { plano, store, product, offer } = entry
    const urls = await upload(db, entry)
    const { ficha } = plano
    const data = {
      store_id: store.id, slug: ficha.slug, title: ficha.nome, description: ficha.descricao,
      track: ficha.trilha, checkout_url: ficha.checkout, role: ficha.tag,
      is_featured: ficha.destaque, sort_order: ficha.ordem, is_published: true,
      cover_url: plano.imagens.capa ? urls.get(plano.imagens.capa) : null,
      banner_url: plano.imagens.banner ? urls.get(plano.imagens.banner) : null,
    }
    const productId = product
      ? (await write(db.from('products').update(data).eq('id', product.id), `produto ${ficha.nome}`), product.id)
      : (await write(db.from('products').insert(data), `produto ${ficha.nome}`, true)).id
    log(`Produto ${product ? 'atualizado' : 'criado'}: ${ficha.nome}`)
    await content(db, productId, plano, urls, entry.modules, entry.items, log)
    const offerId = offer
      ? (await write(db.from('offers').update({ name: ficha.nome }).eq('id', offer.id), `oferta ${ficha.id}`), offer.id)
      : (await write(db.from('offers').insert({ store_id: store.id, name: ficha.nome, payt_product_code: ficha.id }), `oferta ${ficha.id}`, true)).id
    if (!entry.links.some(row => row.offer_id === offerId && row.product_id === productId)) {
      await write(db.from('offer_products').insert({ offer_id: offerId, product_id: productId }), `vínculo da oferta ${ficha.id}`)
    }
    log(`Oferta Payt ${ficha.id} vinculada; link: /${ficha.loja}/${ficha.slug}`)
    results.push({ productId, offerId, status: product ? 'atualizado' : 'criado' })
  }
  return results
}
