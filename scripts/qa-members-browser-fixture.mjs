// Local-only HTTP provider for the real member UI. Never import from application code.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const signingKey = 'fixture-only-jwt-signing-key'
const iso = () => new Date().toISOString()
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

export function createFixture(port = 3312) {
  const origin = `http://127.0.0.1:${port}`
  const store = { id: id(3), slug: 'arquitetura', name: 'Arquitetura', logo_url: null,
    support_url: null, support_whatsapp: null, login_image_url: null }
  const customers = ['aluno@example.test', 'vazio@example.test', 'completo@example.test', 'admin@example.test'].map((email, i) => ({
    id: id(i + 1), email, name: i ? 'Aluno sem materiais' : 'Aluno de teste', blocked_at: null,
  }))
  const products = [
    ['atlas-qa', 'Atlas de patologias', 'Referências'],
    ['projetos-qa', 'Biblioteca de projetos', 'Projetos'],
    ['oferta-qa', 'Coleção de detalhes construtivos', 'Projetos'],
  ].map(([slug, title, track], i) => ({ id: id(10 + i), store_id: store.id, slug, title, track,
    description: 'Material fictício para validar a área de membros localmente.', cover_url: null,
    banner_url: null, content_mode: i === 0 ? 'versions' : 'sections', role: 'front',
    checkout_url: `${origin}/reference?checkout=produto-${i}`, upgrade_checkout_url: `${origin}/reference?checkout=upgrade`,
    student_checkout_url: `${origin}/reference?checkout=aluno`, is_featured: i === 0, sort_order: i,
    is_published: true, created_at: '2026-01-01T00:00:00.000Z' }))
  const modules = [
    { id: id(20), product_id: id(10), required_level: 'basic', title: 'Comece pelo diagnóstico', sort_order: 0 },
    { id: id(21), product_id: id(10), required_level: 'complete', title: 'Aplicação e referências', sort_order: 1 },
    { id: id(22), product_id: id(11), required_level: 'basic', title: 'Arquivos de projeto', sort_order: 0 },
  ].map((row) => ({ ...row, is_published: true, created_at: '2026-01-01T00:00:00.000Z' }))
  const items = [
    [30, 20, 'Guia de diagnóstico', 'arquivo', `${origin}/files/guia.pdf`],
    [31, 20, 'Modelos para consulta', 'arquivo', `${origin}/files/modelos.zip`],
    [32, 21, 'Referência técnica local', 'link', `${origin}/reference`],
    // Recognized URL, deliberately fictional. Block external frames in offline browser QA.
    [33, 21, 'Vídeo demonstrativo fictício', 'video', 'https://www.youtube.com/watch?v=QAfixture01'],
    [34, 22, 'Caderno de projetos residenciais: detalhes de acessibilidade, circulação e organização dos ambientes', 'arquivo', `${origin}/files/guia.pdf`],
    [35, 21, 'Guia Completo', 'arquivo', `${origin}/storage/v1/object/public/arquivos/completo.pdf`],
    [36, 21, 'Arquivo privado Completo', 'arquivo', `${origin}/storage/v1/object/authenticated/arquivos-restritos/qa/completo.pdf`],
    [37, 20, 'Arquivo privado Básico', 'arquivo', `${origin}/storage/v1/object/authenticated/arquivos-restritos/qa/basico.pdf`],
    [38, 20, 'Vídeo Básico fictício', 'video', 'https://www.youtube.com/watch?v=QAfixture01'],
  ].map(([n, moduleId, title, kind, url], i) => ({ id: id(n), module_id: id(moduleId), title, kind, url,
    cover_url: null, sort_order: i, is_published: true, created_at: '2026-01-01T00:00:00.000Z' }))
  const offers = [
    { id: id(40), store_id: store.id, payt_product_code: 'QA-ACERVO', offer_products: [{ product_id: id(10), grant_level: 'basic' }, { product_id: id(11), grant_level: 'basic' }] },
    // A paid offer with no linked products permits legitimate empty-library login.
    { id: id(41), store_id: store.id, payt_product_code: 'QA-EMPTY', offer_products: [] },
    { id: id(42), store_id: store.id, payt_product_code: 'QA-COMPLETE', offer_products: [{ product_id: id(10), grant_level: 'complete' }, { product_id: id(11), grant_level: 'complete' }] },
  ]
  const tables = { stores: [store], customers, products, modules, items, offers,
    orders: customers.map((customer, i) => ({ id: id(50 + i), customer_email: customer.email,
      store_id: store.id, status: 'pago', payt_product_code: i === 2 ? 'QA-COMPLETE' : i ? 'QA-EMPTY' : 'QA-ACERVO' })),
    login_attempts: [], customer_devices: [], member_progress: [],
    item_access: [{ id: id(60), customer_id: id(1), store_id: store.id, product_id: id(10),
      item_id: id(31), kind: 'arquivo', created_at: iso() }],
  }
  const hashes = new Map()
  let failCompletion = false
  let historyDelayMs = 0, failHistory = false, latencyMs = 0
  const metrics = []
  const uploadedImages = new Map(), uploadTokens = new Map()
  let failUploadNumber = 0, uploadNumber = 0
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const user = (customer) => ({ id: customer.id, email: customer.email, aud: 'authenticated', role: 'authenticated',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' })
  function session(customer) {
    const now = Math.floor(Date.now() / 1000)
    const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: customer.id, email: customer.email,
      iss: `${origin}/auth/v1`, aud: 'authenticated', role: 'authenticated', session_id: id(100), iat: now, exp: now + 3600 })}`
    return { access_token: `${data}.${createHmac('sha256', signingKey).update(data).digest('base64url')}`,
      refresh_token: `fixture-refresh-${customer.id}`, token_type: 'bearer', expires_in: 3600, user: user(customer) }
  }
  function authenticated(request) {
    const parts = request.headers.authorization?.replace(/^Bearer\s+/i, '').split('.') || []
    if (parts.length !== 3) return null
    const signature = createHmac('sha256', signingKey).update(`${parts[0]}.${parts[1]}`).digest('base64url')
    if (signature.length !== parts[2].length || !timingSafeEqual(Buffer.from(signature), Buffer.from(parts[2]))) return null
    try {
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url'))
      return claims.exp > Date.now() / 1000 ? customers.find((c) => c.id === claims.sub) : null
    } catch { return null }
  }
  function related(table, row) {
    if (!row) return null
    if (table === 'modules') return { ...row, items: items.filter((item) => item.module_id === row.id), products: products.find((p) => p.id === row.product_id) }
    if (table === 'items') return { ...row, modules: related('modules', modules.find((m) => m.id === row.module_id)) }
    if (table === 'item_access') return { ...row, items: related('items', items.find((i) => i.id === row.item_id)), products: products.find((p) => p.id === row.product_id) }
    return row
  }
  function matches(row, params) {
    return [...params].every(([field, expression]) => {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(field) || field.endsWith('.order')) return true
      const values = field.split('.').reduce((values, part) => values.flatMap((value) => Array.isArray(value?.[part]) ? value[part] : [value?.[part]]), [row])
      const dot = expression.indexOf('.')
      const op = expression.slice(0, dot), expected = expression.slice(dot + 1)
      return values.some((value) => {
        if (op === 'eq') return String(value) === expected
        if (op === 'neq') return String(value) !== expected
        if (op === 'gte') return String(value) >= expected
        if (op === 'in') return expected.slice(1, -1).split(',').map((v) => v.replace(/^"|"$/g, '')).includes(String(value))
        if (op === 'is') return expected === 'null' ? value == null : String(value) === expected
        throw new Error(`Unsupported fixture filter ${field}=${expression}`)
      })
    })
  }
  function send(response, status, body, headers = {}) {
    response.writeHead(status, { 'content-type': 'application/json', ...headers })
    response.end(status === 204 ? undefined : JSON.stringify(body))
  }
  const server = createServer(async (request, response) => {
    try {
      response.setHeader('access-control-allow-origin', '*')
      response.setHeader('access-control-allow-headers', 'authorization, apikey, content-type, x-client-info, x-upsert, cache-control')
      response.setHeader('access-control-allow-methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS')
      response.setHeader('access-control-expose-headers', 'content-range, content-type')
      if (request.method === 'OPTIONS') { response.writeHead(204); return response.end() }
      const url = new URL(request.url, origin), path = url.pathname
      const started = performance.now()
      if (!path.startsWith('/__qa/')) response.on('finish', () => metrics.push({ method: request.method, path, status: response.statusCode, ms: performance.now() - started }))
      if (latencyMs && (path.startsWith('/auth/') || path.startsWith('/rest/') || path.startsWith('/storage/'))) await delay(latencyMs)
      const chunks = []; for await (const chunk of request) chunks.push(chunk)
      const raw = Buffer.concat(chunks)
      const input = raw.length && (request.headers['content-type'] || '').includes('application/json') ? JSON.parse(raw.toString()) : {}
      if (path === '/__qa/health') return send(response, 200, { fixture: 'members', accounts: customers.map((c) => c.email) })
      if (path === '/__qa/session' && request.method === 'POST') {
        const customer = customers.find((c) => c.email === input.email)
        return customer ? send(response, 200, session(customer)) : send(response, 404, { message: 'Unknown fixture account' })
      }
      if (path === '/__qa/uploads' && request.method === 'POST') {
        failUploadNumber = Number(input.failOn) || 0; uploadNumber = 0
        return send(response, 200, { failOn: failUploadNumber })
      }
      if (path.startsWith('/storage/v1/object/upload/sign/covers/')) {
        const objectPath = decodeURIComponent(path.replace('/storage/v1/object/upload/sign/covers/', ''))
        if (request.method === 'POST') {
          if (request.headers.apikey !== 'fixture-service-key') return send(response, 401, { message: 'Fixture service key required' })
          const token = randomUUID(); uploadTokens.set(token, objectPath)
          return send(response, 200, { url: `/object/upload/sign/covers/${encodeURI(objectPath)}?token=${token}` })
        }
        if (request.method === 'PUT') {
          if (uploadTokens.get(url.searchParams.get('token')) !== objectPath) return send(response, 403, { message: 'Invalid fixture upload token' })
          uploadNumber++
          if (uploadNumber === failUploadNumber) return send(response, 503, { message: 'Synthetic upload failure' })
          let bytes = raw, contentType = request.headers['content-type'] || 'application/octet-stream'
          if (contentType.startsWith('multipart/form-data')) {
            const form = await new Request(origin, { method: 'POST', headers: { 'content-type': contentType }, body: raw }).formData()
            const file = form.get('')
            if (!(file instanceof Blob)) return send(response, 400, { message: 'Missing fixture file' })
            bytes = Buffer.from(await file.arrayBuffer()); contentType = file.type
          }
          uploadedImages.set(objectPath, { bytes, contentType })
          return send(response, 200, { Key: `covers/${objectPath}` })
        }
      }
      if (path.startsWith('/storage/v1/object/info/covers/')) {
        if (request.headers.apikey !== 'fixture-service-key') return send(response, 401, { message: 'Fixture service key required' })
        const objectPath = decodeURIComponent(path.replace('/storage/v1/object/info/covers/', ''))
        const image = uploadedImages.get(objectPath)
        return image ? send(response, 200, { name: objectPath, size: image.bytes.length, content_type: image.contentType }) : send(response, 404, { message: 'Fixture image not found' })
      }
      if (path.startsWith('/storage/v1/object/public/covers/')) {
        const image = uploadedImages.get(decodeURIComponent(path.replace('/storage/v1/object/public/covers/', '')))
        if (!image) return send(response, 404, { message: 'Fixture image not found' })
        response.writeHead(200, { 'content-type': image.contentType }); return response.end(image.bytes)
      }
      if (path === '/__qa/history' && request.method === 'POST') {
        historyDelayMs = Math.min(5000, Math.max(0, Number(input.delayMs) || 0))
        failHistory = input.fail === true
        return send(response, 200, { delayMs: historyDelayMs, fail: failHistory })
      }
      if (path === '/__qa/latency' && request.method === 'POST') {
        latencyMs = Math.min(1000, Math.max(0, Number(input.ms) || 0))
        return send(response, 200, { ms: latencyMs })
      }
      if (path === '/__qa/metrics') {
        if (request.method === 'POST') metrics.length = 0
        return send(response, 200, { requests: metrics, historyRows: tables.item_access.length, uploads: [...uploadedImages].map(([path, image]) => ({ path, size: image.bytes.length, mime: image.contentType })) })
      }
      if (path === '/__qa/access' && request.method === 'POST') {
        const order = tables.orders.find((row) => row.customer_email === input.email)
        if (!order) return send(response, 404, { message: 'Unknown fixture account' })
        order.payt_product_code = input.level === 'complete' ? 'QA-COMPLETE' : input.level === 'basic' ? 'QA-ACERVO' : 'QA-EMPTY'
        return send(response, 200, { email: input.email, level: input.level })
      }
      if (path.startsWith('/storage/v1/object/sign/arquivos-restritos/') && request.method === 'POST') {
        if (request.headers.apikey !== 'fixture-service-key') return send(response, 401, { message: 'Fixture service key required' })
        return send(response, 200, { signedURL: `${path.replace('/storage/v1', '')}?token=fixture-only` })
      }
      if (path.startsWith('/storage/v1/object/') && request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="fixture.pdf"' })
        return response.end(makePdf())
      }
      if (path === '/auth/v1/otp' && request.method === 'POST') return send(response, 200, {})
      if (path === '/__qa/completion-failure' && request.method === 'POST') {
        failCompletion = input.enabled === true
        return send(response, 200, { enabled: failCompletion })
      }
      if (path === '/reference') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return response.end('<h1>Referência local de QA</h1><p>Conteúdo fictício. Nenhum serviço externo.</p>') }
      if (path === '/files/guia.pdf' || path === '/files/modelos.zip') {
        const pdf = path.endsWith('.pdf')
        response.writeHead(200, { 'content-type': pdf ? 'application/pdf' : 'application/zip',
          'content-disposition': `attachment; filename="${pdf ? 'guia.pdf' : 'modelos.zip'}"` })
        return response.end(pdf ? makePdf() : Buffer.from('504b0506000000000000000000000000000000000000', 'hex'))
      }
      if (path === '/auth/v1/admin/generate_link' && request.method === 'POST') {
        const customer = customers.find((c) => c.email === input.email)
        if (!customer) return send(response, 404, { message: 'Unknown fixture account' })
        const hash = randomUUID(); hashes.set(hash, customer)
        return send(response, 200, { ...user(customer), action_link: `${origin}/auth/v1/verify?token=${hash}`, email_otp: '123456', hashed_token: hash, verification_type: 'magiclink', redirect_to: origin })
      }
      if (path === '/auth/v1/verify' && request.method === 'POST') {
        const customer = input.token === '123456' ? customers.find((c) => c.email === input.email) : hashes.get(input.token_hash); hashes.delete(input.token_hash)
        return customer ? send(response, 200, session(customer)) : send(response, 403, { code: 'otp_expired', msg: 'Invalid fixture token' })
      }
      if (path === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
        const customer = customers.find((c) => input.refresh_token === `fixture-refresh-${c.id}`)
        return customer ? send(response, 200, session(customer)) : send(response, 401, { msg: 'Invalid refresh token' })
      }
      if (path === '/auth/v1/user') { const customer = authenticated(request); return customer ? send(response, 200, user(customer)) : send(response, 401, { msg: 'Invalid JWT' }) }
      if (path === '/auth/v1/logout') return send(response, 204)
      if (path === '/rest/v1/rpc/record_login_attempt_atomic' && request.method === 'POST') {
        if (request.headers.apikey !== 'fixture-service-key') return send(response, 401, { message: 'Fixture service key required' })
        const customer = input.p_email_hash && typeof input.p_email === 'string' ? customers.find((row) => row.email === input.p_email.trim().toLowerCase()) : null
        tables.login_attempts.push({ id: randomUUID(), ip: input.p_ip, email_hash: input.p_email_hash ?? null, store_id: input.p_store_id, customer_id: customer?.id ?? null, created_at: iso() })
        return send(response, 204)
      }
      const table = path.replace('/rest/v1/', '')
      if (path.startsWith('/rest/v1/') && tables[table]) {
        if (request.headers.apikey !== 'fixture-service-key') return send(response, 401, { message: 'Fixture service key required' })
        if (request.method === 'PATCH') {
          const rows = tables[table].filter((row) => matches(related(table, row), url.searchParams))
          if (table === 'products' && input.slug && tables.products.some((other) => rows.some((row) => other.id !== row.id && other.store_id === row.store_id && other.slug === input.slug))) return send(response, 409, { code: '23505', message: 'duplicate slug' })
          rows.forEach((row) => Object.assign(row, input, { updated_at: iso() }))
          return send(response, 200, (request.headers.accept || '').includes('application/vnd.pgrst.object+json') ? rows[0] : rows)
        }
        if (request.method === 'POST') {
          if (table === 'item_access') {
            if (historyDelayMs) await delay(historyDelayMs)
            if (failHistory) return send(response, 503, { code: 'QA_FAILURE', message: 'Synthetic history write failure' })
          }
          if (table === 'member_progress' && failCompletion) return send(response, 503, { code: 'QA_FAILURE', message: 'Synthetic completion write failure' })
          const rows = Array.isArray(input) ? input : [input]
          for (const row of rows) {
            const conflict = url.searchParams.get('on_conflict')?.split(',')
            const existing = conflict && tables[table].find((old) => conflict.every((field) => old[field] === row[field]))
            if (existing) Object.assign(existing, row, { updated_at: iso() })
            else tables[table].push({ id: randomUUID(), created_at: iso(), updated_at: iso(), ...row })
          }
          return send(response, 201, rows)
        }
        if (request.method === 'DELETE') {
          if (table === 'member_progress' && failCompletion) return send(response, 503, { code: 'QA_FAILURE', message: 'Synthetic completion write failure' })
          tables[table] = tables[table].filter((row) => !matches(row, url.searchParams))
          return send(response, 204)
        }
        if (!['GET', 'HEAD'].includes(request.method)) return send(response, 405, { message: 'Unsupported fixture method' })
        let rows = tables[table].map((row) => related(table, row)).filter((row) => matches(row, url.searchParams))
        const count = rows.length
        const orders = (url.searchParams.get('order') || '').split(',').filter(Boolean)
        rows.sort((a, b) => { for (const order of orders) { const [field, direction] = order.split('.'); const cmp = String(a[field]).localeCompare(String(b[field]), 'en', { numeric: true }); if (cmp) return direction === 'desc' ? -cmp : cmp } return 0 })
        if (url.searchParams.has('limit')) rows = rows.slice(0, Number(url.searchParams.get('limit')))
        const headers = { 'content-range': count ? `0-${Math.max(0, rows.length - 1)}/${count}` : '*/0' }
        if ((request.headers.accept || '').includes('application/vnd.pgrst.object+json')) return rows.length === 1 ? send(response, 200, rows[0], headers) : send(response, 406, { code: 'PGRST116', details: `The result contains ${rows.length} rows`, message: 'JSON object requested, multiple (or no) rows returned' }, headers)
        return send(response, 200, rows, headers)
      }
      console.error(`Unhandled fixture request: ${request.method} ${path}`)
      return send(response, 404, { message: 'Fixture route not found' })
    } catch (error) { console.error(error.message); return send(response, 500, { message: error.message }) }
  })
  return { server, tables }
}

function makePdf() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const stream = 'BT /F1 18 Tf 50 780 Td (Material ficticio - QA local) Tj ET'
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  let pdf = '%PDF-1.4\n'; const offsets = [0]
  for (const [index, body] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${body}\nendobj\n` }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.QA_PROVIDER_PORT || 3312)
  const { server } = createFixture(port)
  server.listen(port, '127.0.0.1', () => console.log(`Member fixture listening at http://127.0.0.1:${port}`))
}
