// Synthetic localhost backend and Next launcher; never imports production credentials.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createFixture, id } from '../../../scripts/qa-members-browser-fixture.mjs'

export function createCommunityFixture(port = 3341) {
  const fixture = createFixture(port)
  const { tables } = fixture
  const architecture = tables.stores[0]
  architecture.community_whatsapp_url = 'https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t'
  architecture.support_url = 'https://wa.me/5511999999999'
  tables.member_terms_acceptance = tables.customers.map(customer => ({ customer_id: customer.id, store_id: architecture.id, terms_version: '2026-09-26', accepted_at: new Date().toISOString() }))
  const empty = { ...tables.products[0], id: id(70), slug: 'vazio-qa', title: 'Produto vazio de QA', is_featured: false }
  tables.products.push(empty)
  tables.offers[0].offer_products.push({ product_id: empty.id })
  const other = { ...architecture, id: id(71), slug: 'outra-loja', name: 'Outra loja', community_whatsapp_url: null }
  tables.stores.push(other)
  tables.products.push({ ...tables.products[0], id: id(72), store_id: other.id, slug: 'material-qa', title: 'Material da outra loja' })
  tables.modules.push({ ...tables.modules[0], id: id(73), product_id: id(72) })
  tables.items.push({ ...tables.items[0], id: id(74), module_id: id(73) })
  tables.offers.push({ id: id(75), store_id: other.id, payt_product_code: 'QA-OTHER', offer_products: [{ product_id: id(72) }] })
  tables.orders.push({ id: id(76), customer_email: tables.customers[0].email, store_id: other.id, status: 'pago', payt_product_code: 'QA-OTHER' })

  return fixture
}

async function assertFree(port) {
  const probe = createServer()
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve) })
  await new Promise(resolve => probe.close(resolve))
}

async function main() {
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  // Next loads local env files automatically. Refuse them instead of inheriting secrets.
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local']) {
    if (existsSync(`${root}/${name}`)) throw new Error(`Remove ${name} from this isolated QA checkout before running the fixture`)
  }
  await assertFree(3340); await assertFree(3341)
  const { server } = createCommunityFixture()
  await new Promise(resolve => server.listen(3341, '127.0.0.1', resolve))
  const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'COMSPEC', 'PATHEXT'].filter(key => process.env[key]).map(key => [key, process.env[key]]))
  Object.assign(env, {
    NODE_ENV: process.argv.includes('--production') ? 'production' : 'development', NEXT_TELEMETRY_DISABLED: '1',
    SUPABASE_URL: 'http://127.0.0.1:3341', SUPABASE_PUBLISHABLE_KEY: 'fixture-service-key', SUPABASE_SECRET_KEY: 'fixture-service-key',
    APP_URL: 'http://127.0.0.1:3340', ADMIN_EMAILS: 'admin@example.test', DEFAULT_STORE_SLUG: 'arquitetura',
    LOGIN_GUARD_SECRET: 'fixture-only-login-guard-secret', PAYT_INTEGRATION_KEY: 'fixture-unused', RESEND_API_KEY: 'fixture-unused', EMAIL_FROM: 'QA <qa@example.test>',
  })
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', process.argv.includes('--production') ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', '3340'], { cwd: root, env, stdio: 'inherit', windowsHide: true })
  let stopping = false
  const stop = () => { if (stopping) return; stopping = true; child.kill('SIGTERM'); server.close(); }
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
  child.on('error', error => { console.error(error); stop(); process.exitCode = 1 })
  child.on('exit', code => { stop(); process.exitCode = code || 0 })
  console.log('Synthetic group QA: http://127.0.0.1:3340/arquitetura/entrar — aluno@example.test')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1 })
