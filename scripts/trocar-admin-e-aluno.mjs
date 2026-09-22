// Troca de papéis: grupoelevamax@gmail.com passa a ser admin e arq.allanp@gmail.com vira o aluno de teste.
// Um e-mail de admin não pode ser cliente (o login de aluno recusa admins), por isso o cliente antigo sai.
// Uso: node scripts/trocar-admin-e-aluno.mjs
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

const NOVO_ADMIN = 'grupoelevamax@gmail.com'
const NOVO_ALUNO = 'arq.allanp@gmail.com'

const { data: loja } = await db.from('stores').select('id').eq('slug', env.DEFAULT_STORE_SLUG || 'arquitetura').single()

// 1. Cliente de teste: garante usuário e linha de cliente para o novo aluno.
let { data: aluno } = await db.from('customers').select('id, email').eq('email', NOVO_ALUNO).maybeSingle()
if (!aluno) {
  const criado = await db.auth.admin.createUser({ email: NOVO_ALUNO, email_confirm: true, user_metadata: { name: 'Teste' } })
  let userId = criado.data?.user?.id
  if (criado.error) {
    const { data: existente } = await db.rpc('get_auth_user_id_by_email', { p_email: NOVO_ALUNO })
    userId = existente
  }
  const { data, error } = await db
    .from('customers')
    .insert({ id: userId, email: NOVO_ALUNO, name: 'Teste' })
    .select('id, email')
    .single()
  if (error) throw error
  aluno = data
  console.log(`cliente de teste criado: ${NOVO_ALUNO}`)
} else {
  console.log(`cliente de teste já existia: ${NOVO_ALUNO}`)
}

// 2. Passa os pedidos de teste para o novo aluno.
const { data: pedidos, error: erroPedidos } = await db
  .from('orders')
  .update({ customer_email: NOVO_ALUNO, customer_name: 'Teste' })
  .eq('customer_email', NOVO_ADMIN)
  .select('payt_transaction_id, payt_product_code')
if (erroPedidos) throw erroPedidos
console.log(`pedidos transferidos: ${pedidos.length}`)
for (const p of pedidos) console.log(`  ${p.payt_transaction_id} (${p.payt_product_code})`)

// 3. Remove o registro de cliente do novo admin (ele deixa de ser aluno).
const { data: adminCliente } = await db.from('customers').select('id').eq('email', NOVO_ADMIN).maybeSingle()
if (adminCliente) {
  await db.from('customer_devices').delete().eq('customer_id', adminCliente.id)
  await db.from('email_log').delete().eq('customer_id', adminCliente.id)
  const { error } = await db.from('customers').delete().eq('id', adminCliente.id)
  if (error) throw error
  console.log(`registro de cliente removido: ${NOVO_ADMIN}`)
}

const { data: finais } = await db.from('customers').select('email')
console.log('\nclientes atuais:', (finais ?? []).map((c) => c.email).join(', ') || '(nenhum)')
