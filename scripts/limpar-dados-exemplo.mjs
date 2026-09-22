// Remove os dados de exemplo criados durante o desenvolvimento e deixa um pedido de teste
// com o código real, para continuar validando o acesso sem compra.
// Uso: node scripts/limpar-dados-exemplo.mjs
import { readFileSync } from 'node:fs'
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

const CLIENTE_TESTE = 'grupoelevamax@gmail.com'
const SLUGS_REAIS = ['atlas-visual-das-patologias', 'bonus-atlas-patologias']
const CODIGOS_REAIS = ['45WX6J', 'LGADK6']

const { data: produtos, error: erroProdutos } = await db.from('products').select('id, title, slug')
if (erroProdutos) throw erroProdutos
const exemplos = produtos.filter((p) => !SLUGS_REAIS.includes(p.slug))
console.log(`produtos de exemplo encontrados: ${exemplos.length}`)
for (const p of exemplos) console.log(`  - ${p.title}`)

if (exemplos.length) {
  const ids = exemplos.map((p) => p.id)
  const { data: modulos } = await db.from('modules').select('id').in('product_id', ids)
  const moduloIds = (modulos ?? []).map((m) => m.id)
  if (moduloIds.length) {
    const { error } = await db.from('items').delete().in('module_id', moduloIds)
    if (error) throw error
  }
  for (const tabela of ['modules', 'offer_products']) {
    const coluna = tabela === 'modules' ? 'product_id' : 'product_id'
    const { error } = await db.from(tabela).delete().in(coluna, ids)
    if (error) throw error
  }
  const { error } = await db.from('products').delete().in('id', ids)
  if (error) throw error
  console.log('produtos de exemplo removidos')
}

const { data: ofertas } = await db.from('offers').select('id, name, payt_product_code')
const ofertasExemplo = (ofertas ?? []).filter((o) => !CODIGOS_REAIS.includes(o.payt_product_code))
for (const o of ofertasExemplo) {
  await db.from('offer_products').delete().eq('offer_id', o.id)
  const { error } = await db.from('offers').delete().eq('id', o.id)
  if (error) throw error
  console.log(`oferta removida: ${o.payt_product_code} (${o.name})`)
}

const { data: pedidos } = await db.from('orders').select('id, payt_transaction_id, payt_product_code')
const pedidosExemplo = (pedidos ?? []).filter((p) => p.payt_transaction_id.startsWith('TESTE-'))
if (pedidosExemplo.length) {
  const { error } = await db.from('orders').delete().in('id', pedidosExemplo.map((p) => p.id))
  if (error) throw error
  console.log(`pedidos de teste removidos: ${pedidosExemplo.length}`)
}

// Pedido de teste com o código real, para o cliente de teste continuar com acesso.
const { data: loja } = await db.from('stores').select('id').eq('slug', env.DEFAULT_STORE_SLUG || 'arquitetura').single()
const { error: erroPedido } = await db.from('orders').insert({
  store_id: loja.id,
  payt_transaction_id: 'INTERNO-TESTE-COMPLETO',
  payt_product_code: 'LGADK6',
  payt_product_name: 'Atlas Patologias - Completo (teste interno)',
  customer_email: CLIENTE_TESTE,
  customer_name: 'Teste interno',
  status: 'pago',
  status_rank: 1,
  payt_type: 'order',
  is_test: true,
  amount_cents: 0,
  paid_at: new Date().toISOString(),
})
if (erroPedido) throw erroPedido
console.log(`pedido de teste recriado para ${CLIENTE_TESTE} (LGADK6)`)

const { data: restantes } = await db.from('products').select('title, track, sort_order').order('sort_order')
console.log('\nprodutos atuais:')
for (const p of restantes ?? []) console.log(`  ${p.sort_order}. ${p.title} [${p.track || 'sem trilha'}]`)
