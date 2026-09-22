// Cadastro do Atlas Visual das Patologias: sobe os arquivos e cria produtos, módulos, itens e ofertas.
// Pode rodar mais de uma vez: nada é duplicado (busca por slug, por código da oferta e por título do item).
// Uso: node scripts/cadastro-atlas-patologias.mjs
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

const BUCKET = 'arquivos'
const RAIZ = 'C:\\Users\\arqal\\OneDrive\\Desktop\\Ideias Low Ticket\\ARQUITETURA\\Patologias Construção Civil\\99-entrega-final'
const TIPOS = { pdf: 'application/pdf', zip: 'application/zip' }

async function garantirBucket() {
  const { data } = await db.storage.listBuckets()
  if (data?.some((b) => b.name === BUCKET)) return
  const { error } = await db.storage.createBucket(BUCKET, { public: true })
  if (error) throw error
  console.log(`bucket ${BUCKET} criado`)
}

async function subir(caminhoLocal, destino) {
  const arquivo = readFileSync(caminhoLocal)
  const ext = destino.split('.').pop().toLowerCase()
  const { error } = await db.storage.from(BUCKET).upload(destino, arquivo, {
    contentType: TIPOS[ext] ?? 'application/octet-stream',
    upsert: true,
  })
  if (error) throw error
  const url = db.storage.from(BUCKET).getPublicUrl(destino).data.publicUrl
  console.log(`  subiu ${destino} (${(arquivo.length / 1024 / 1024).toFixed(1)} MB)`)
  return `${url}?download=${encodeURIComponent(basename(destino))}`
}

async function acharLoja(slug) {
  const { data, error } = await db.from('stores').select('id').eq('slug', slug).single()
  if (error) throw error
  return data.id
}

async function garantirProduto(p) {
  const { data: existente } = await db.from('products').select('id').eq('store_id', p.store_id).eq('slug', p.slug).maybeSingle()
  if (existente) {
    const { error } = await db.from('products').update(p).eq('id', existente.id)
    if (error) throw error
    console.log(`produto atualizado: ${p.title}`)
    return existente.id
  }
  const { data, error } = await db.from('products').insert(p).select('id').single()
  if (error) throw error
  console.log(`produto criado: ${p.title}`)
  return data.id
}

async function garantirModulo(productId, title, sortOrder) {
  const { data: existente } = await db.from('modules').select('id').eq('product_id', productId).eq('title', title).maybeSingle()
  if (existente) return existente.id
  const { data, error } = await db
    .from('modules')
    .insert({ product_id: productId, title, sort_order: sortOrder, is_published: true })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function garantirItem(moduleId, title, url, sortOrder) {
  const { data: existente } = await db.from('items').select('id').eq('module_id', moduleId).eq('title', title).maybeSingle()
  const row = { module_id: moduleId, title, kind: 'arquivo', url, sort_order: sortOrder, is_published: true }
  if (existente) {
    const { error } = await db.from('items').update(row).eq('id', existente.id)
    if (error) throw error
    return
  }
  const { error } = await db.from('items').insert(row)
  if (error) throw error
}

async function garantirOferta(storeId, name, code, productIds) {
  const { data: existente } = await db.from('offers').select('id').eq('payt_product_code', code).maybeSingle()
  let offerId = existente?.id
  if (offerId) {
    const { error } = await db.from('offers').update({ store_id: storeId, name }).eq('id', offerId)
    if (error) throw error
  } else {
    const { data, error } = await db.from('offers').insert({ store_id: storeId, name, payt_product_code: code }).select('id').single()
    if (error) throw error
    offerId = data.id
  }
  const { error: vinculoError } = await db
    .from('offer_products')
    .upsert(productIds.map((product_id) => ({ offer_id: offerId, product_id })), { onConflict: 'offer_id,product_id', ignoreDuplicates: true })
  if (vinculoError) throw vinculoError
  console.log(`oferta ${code}: ${name} → ${productIds.length} produto(s)`)
}

const storeId = await acharLoja(env.DEFAULT_STORE_SLUG || 'arquitetura')
await garantirBucket()

console.log('subindo arquivos...')
const urlPrincipal = await subir(
  `${RAIZ}\\entregavel-principal\\Guia Visual das Patologias na Construcao Civil.pdf`,
  'patologias/guia-visual-das-patologias.pdf',
)
const bonusPdf = [
  ['Bônus 1 — Checklist Visual de Inspeção de Edificações', 'Bonus 1 - Checklist Visual de Inspecao de Edificacoes.pdf', 'patologias/bonus-1-checklist-visual-de-inspecao.pdf'],
  ['Bônus 2 — Modelo de Relatório de Inspeção', 'Bonus 2 - Modelo de Relatorio de Inspecao.pdf', 'patologias/bonus-2-modelo-de-relatorio-de-inspecao.pdf'],
  ['Bônus 3 — Catálogo Visual de Erros de Execução', 'Bonus 3 - Catalogo Visual de Erros de Execucao.pdf', 'patologias/bonus-3-catalogo-visual-de-erros-de-execucao.pdf'],
]
const bonusKit = [
  ['Bônus 1 — Kit Checklist editável', 'Bonus 1 - Kit Checklist Editavel.zip', 'patologias/bonus-1-kit-checklist-editavel.zip'],
  ['Bônus 2 — Kit Relatório de Inspeção editável', 'Bonus 2 - Kit Relatorio de Inspecao Editavel.zip', 'patologias/bonus-2-kit-relatorio-editavel.zip'],
  ['Bônus 3 — Kit Checklist de Controle de Execução', 'Bonus 3 - Kit Checklist de Controle de Execucao.zip', 'patologias/bonus-3-kit-controle-de-execucao.zip'],
]
for (const grupo of [bonusPdf, bonusKit]) {
  for (const linha of grupo) linha.push(await subir(`${RAIZ}\\bonus\\${linha[1]}`, linha[2]))
}

const atlasId = await garantirProduto({
  store_id: storeId,
  slug: 'atlas-visual-das-patologias',
  title: 'Atlas Visual das Patologias',
  track: 'Patologias',
  description:
    'Consulte um material técnico, visual e organizado para identificar manifestações patológicas, diferenciar problemas semelhantes e conduzir análises iniciais com mais segurança durante estudos, obras, reformas e visitas técnicas.',
  is_featured: true,
  sort_order: 1,
  is_published: true,
})
const moduloPrincipal = await garantirModulo(atlasId, 'Material principal', 1)
await garantirItem(moduloPrincipal, 'Guia Visual das Patologias na Construção Civil', urlPrincipal, 1)

const bonusId = await garantirProduto({
  store_id: storeId,
  slug: 'bonus-atlas-patologias',
  title: 'Bônus do Atlas de Patologias',
  track: 'Patologias',
  description: '',
  is_featured: false,
  sort_order: 2,
  is_published: true,
})
const moduloBonus = await garantirModulo(bonusId, 'Bônus', 1)
const moduloKits = await garantirModulo(bonusId, 'Kits editáveis', 2)
for (const [i, [titulo, , , url]] of bonusPdf.entries()) await garantirItem(moduloBonus, titulo, url, i + 1)
for (const [i, [titulo, , , url]] of bonusKit.entries()) await garantirItem(moduloKits, titulo, url, i + 1)

await garantirOferta(storeId, 'Atlas Patologias — Básico', '45WX6J', [atlasId])
await garantirOferta(storeId, 'Atlas Patologias — Completo', 'LGADK6', [atlasId, bonusId])

console.log('\npronto.')
