// Local browser QA for the real member pages. All accounts, orders and URLs are synthetic.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createCommunityFixture } from '../grupo-whatsapp/browser-fixture.mjs'
import { id } from '../../../scripts/qa-members-browser-fixture.mjs'

const APP_PORT = 3350
const PROVIDER_PORT = 3351
export function createAtlasProtocolFixture(port = PROVIDER_PORT) {
  const fixture = createCommunityFixture(port)
  const { tables } = fixture
  const checkout = `http://127.0.0.1:${port}/reference?checkout=protocolo`
  const store = tables.stores.find(row => row.slug === 'arquitetura')
  const atlas = tables.products.find(row => row.id === id(10))
  if (!store || !atlas) throw new Error('Base fixture is missing the Architecture store or Atlas')

  atlas.slug = 'atlas-visual-das-patologias-na-construcao-civil-completo'
  atlas.title = 'Atlas Visual das Patologias na Construção Civil'
  atlas.track = 'Patologias'
  atlas.role = 'front'
  atlas.content_mode = 'versions'
  atlas.complementary_product_id = id(81)
  tables.modules.find(row => row.id === id(20)).required_level = 'basic'
  tables.modules.find(row => row.id === id(21)).required_level = 'complete'

  const protocol = {
    ...tables.products[2], id: id(81), store_id: store.id,
    slug: 'protocolo-anti-retrabalho', title: 'Protocolo Anti-Retrabalho',
    track: 'Protocolos Profissionais', role: 'upsell', content_mode: 'sections',
    description: 'Material fictício para testar acesso independente ao complemento.',
    checkout_url: checkout, student_checkout_url: checkout,
    complementary_product_id: null, is_featured: false, sort_order: 4,
    is_published: true,
  }
  tables.products.push(protocol)
  tables.modules.push({
    id: id(82), product_id: protocol.id, title: 'Método C.I.A.',
    required_level: 'basic', sort_order: 0, is_published: true,
    created_at: '2026-01-01T00:00:00.000Z',
  })
  tables.items.push({
    id: id(83), module_id: id(82), title: 'Guia sintético do Protocolo',
    kind: 'arquivo', url: `http://127.0.0.1:${port}/files/guia.pdf`,
    cover_url: null, sort_order: 0, is_published: true,
    created_at: '2026-01-01T00:00:00.000Z',
  })

  // The existing student has only Basic Atlas. The second student has Complete Atlas
  // plus a separately paid Protocolo order; the editorial link never grants access.
  tables.offers[0].offer_products = [
    { product_id: atlas.id, grant_level: 'basic' },
    { product_id: id(11), grant_level: 'complete' },
  ]
  const protocolStudent = {
    id: id(84), email: 'protocolo@example.test',
    name: 'Aluno Protocolo', blocked_at: null,
  }
  tables.customers.push(protocolStudent)
  tables.member_terms_acceptance.push({
    customer_id: protocolStudent.id, store_id: store.id,
    terms_version: '2026-09-26', accepted_at: new Date().toISOString(),
  })
  tables.offers.push(
    { id: id(85), store_id: store.id, payt_product_code: 'QA-ATLAS-COMPLETE',
      offer_products: [{ product_id: atlas.id, grant_level: 'complete' }] },
    { id: id(86), store_id: store.id, payt_product_code: 'QA-PROTOCOLO',
      offer_products: [{ product_id: protocol.id, grant_level: 'complete' }] },
  )
  tables.orders.push(
    { id: id(87), customer_email: protocolStudent.email, store_id: store.id,
      status: 'pago', payt_product_code: 'QA-ATLAS-COMPLETE' },
    { id: id(88), customer_email: protocolStudent.email, store_id: store.id,
      status: 'pago', payt_product_code: 'QA-PROTOCOLO' },
  )
  return fixture
}

async function assertFree(port) {
  const probe = createServer()
  await new Promise((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(port, '127.0.0.1', resolve)
  })
  await new Promise(resolve => probe.close(resolve))
}

async function main() {
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  // Next loads .env files automatically, so refuse every conventional local variant.
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local',
    '.env.production', '.env.production.local', '.env.test', '.env.test.local']) {
    if (existsSync(`${root}/${name}`)) throw new Error(`Remove ${name} from this isolated QA checkout before running the fixture`)
  }
  await assertFree(APP_PORT)
  await assertFree(PROVIDER_PORT)
  const { server } = createAtlasProtocolFixture()
  await new Promise(resolve => server.listen(PROVIDER_PORT, '127.0.0.1', resolve))

  const env = Object.fromEntries(
    ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP',
      'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'COMSPEC', 'PATHEXT']
      .filter(key => process.env[key]).map(key => [key, process.env[key]]),
  )
  const production = process.argv.includes('--production')
  Object.assign(env, {
    NODE_ENV: production ? 'production' : 'development', NEXT_TELEMETRY_DISABLED: '1',
    SUPABASE_URL: `http://127.0.0.1:${PROVIDER_PORT}`,
    SUPABASE_PUBLISHABLE_KEY: 'fixture-service-key', SUPABASE_SECRET_KEY: 'fixture-service-key',
    APP_URL: `http://127.0.0.1:${APP_PORT}`, ADMIN_EMAILS: 'admin@example.test',
    DEFAULT_STORE_SLUG: 'arquitetura', LOGIN_GUARD_SECRET: 'fixture-only-login-guard-secret',
    PAYT_INTEGRATION_KEY: 'fixture-unused', RESEND_API_KEY: 'fixture-unused',
    EMAIL_FROM: 'QA <qa@example.test>',
  })
  const args = ['node_modules/next/dist/bin/next', production ? 'start' : 'dev']
  if (!production) args.push('--webpack')
  args.push('--hostname', '127.0.0.1', '--port', String(APP_PORT))
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true })
  let stopping = false
  const stop = () => {
    if (stopping) return
    stopping = true
    child.kill('SIGTERM')
    server.close()
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  child.on('error', error => { console.error(error); stop(); process.exitCode = 1 })
  child.on('exit', code => { stop(); process.exitCode = code || 0 })
  console.log(`Synthetic Atlas/Protocolo QA: http://127.0.0.1:${APP_PORT}/arquitetura/entrar`)
  console.log('Accounts: aluno@example.test (Atlas Basic), protocolo@example.test (Atlas Complete + Protocolo)')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
