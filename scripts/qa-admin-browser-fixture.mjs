import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'

const port = Number(process.env.QA_PROVIDER_PORT || 3311)
const key = 'local-browser-qa-only-secret'
const email = 'admin@example.test'
const userId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'
const store = {
  id: '00000000-0000-4000-8000-000000000003', slug: 'teste', name: 'Loja de teste',
  logo_url: null, support_url: null, support_whatsapp: null, login_image_url: null,
}

if (process.argv.includes('--expired-token')) {
  const issuedAt = Date.now() - 604800001
  const signature = createHmac('sha256', 'fixture-only-hmac-secret-32-chars-minimum')
    .update(JSON.stringify(['admin-browser-session:v1', issuedAt, userId, sessionId]))
    .digest('base64url')
  console.log(`${issuedAt}.${signature}`)
  process.exit(0)
}

function base64url(value) { return Buffer.from(JSON.stringify(value)).toString('base64url') }
function token() {
  const now = Math.floor(Date.now() / 1000)
  const head = base64url({ alg: 'HS256', typ: 'JWT' })
  const payload = base64url({ iss: `http://127.0.0.1:${port}/auth/v1`, sub: userId, aud: 'authenticated',
    role: 'authenticated', email, session_id: sessionId, iat: now, exp: now + 3600 })
  const data = `${head}.${payload}`
  return `${data}.${createHmac('sha256', key).update(data).digest('base64url')}`
}
function validToken(value) {
  const parts = value?.split('.') || []
  if (parts.length !== 3) return false
  const expected = Buffer.from(createHmac('sha256', key).update(`${parts[0]}.${parts[1]}`).digest('base64url'))
  const received = Buffer.from(parts[2])
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false
  try { return JSON.parse(Buffer.from(parts[1], 'base64url')).exp > Date.now() / 1000 } catch { return false }
}
function user() {
  return { id: userId, aud: 'authenticated', role: 'authenticated', email,
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
    created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() }
}
function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json', ...headers })
  response.end(JSON.stringify(body))
}

createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`)
  let body = ''
  for await (const chunk of request) body += chunk
  let input = {}
  try { input = body ? JSON.parse(body) : {} } catch { /* Invalid input remains empty. */ }
  const path = url.pathname

  if (path === '/auth/v1/otp' && request.method === 'POST') {
    return send(response, 200, {})
  }
  if (path === '/auth/v1/verify' && request.method === 'POST') {
    if (input.email !== email || input.token !== '123456') return send(response, 403, { code: 'otp_expired', msg: 'Invalid token' })
    return send(response, 200, { access_token: token(), token_type: 'bearer', expires_in: 3600,
      refresh_token: 'fixture-refresh-token', user: user() })
  }
  if (path === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    if (input.refresh_token !== 'fixture-refresh-token') return send(response, 401, { code: 'invalid_grant', msg: 'Invalid refresh token' })
    return send(response, 200, { access_token: token(), token_type: 'bearer', expires_in: 3600,
      refresh_token: 'fixture-refresh-token', user: user() })
  }
  if (path === '/auth/v1/user') {
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '')
    return validToken(bearer) ? send(response, 200, user()) : send(response, 401, { code: 'bad_jwt', msg: 'Invalid JWT' })
  }
  if (path === '/auth/v1/logout') return send(response, 204, {})

  if (path === '/rest/v1/stores') {
    const rows = url.searchParams.has('slug') ? (url.searchParams.get('slug') === 'eq.teste' ? [store] : []) : [store]
    const accept = request.headers.accept || ''
    if (accept.includes('application/vnd.pgrst.object+json')) {
      return rows.length ? send(response, 200, rows[0]) : send(response, 406, { code: 'PGRST116', message: 'No rows' })
    }
    return send(response, 200, rows)
  }
  if (path === '/rest/v1/rpc/store_customer_success') return send(response, 200, [])
  if (path === '/rest/v1/email_log') return send(response, 200, [], { 'content-range': '0-0/0' })

  console.error(`Unhandled fixture request: ${request.method} ${path}`)
  return send(response, 404, { message: 'Fixture route not found' })
}).listen(port, '127.0.0.1', () => console.log(`Fixture listening on ${port}`))
