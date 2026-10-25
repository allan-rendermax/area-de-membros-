import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
try {
  const local = parseEnv(await readFile('.env.telegram.local', 'utf8'))
  for (const [key, value] of Object.entries(local)) if (key.startsWith('TELEGRAM_')) process.env[key] = value
} catch (error) { if (error.code !== 'ENOENT') throw new Error('Não foi possível ler a configuração privada.') }

const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
const expectedUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '').trim()
async function call(method, payload = {}) {
  if (!token || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new Error('Preencha TELEGRAM_BOT_TOKEN em .env.telegram.local.')
  let response
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) })
    response = await r.json()
    if (!r.ok || response.ok !== true) throw new Error('telegram_error')
  } catch { throw new Error(`Falha na chamada Telegram ${method}. Confira token e conectividade.`) }
  return response.result
}
async function info() {
  const bot = await call('getMe')
  if (expectedUsername && bot.username.toLowerCase() !== expectedUsername.toLowerCase()) throw new Error('O token pertence a outro bot. Confira TELEGRAM_BOT_USERNAME.')
  console.log(JSON.stringify({ bot: '@' + bot.username, id: bot.id }))
}
async function main() {
  const mode = process.argv[2] || 'info'
  if (!['info', 'users', 'activate'].includes(mode)) throw new Error('Use info, users ou activate.')
  await info()
  if (mode === 'info') {
    const webhook = await call('getWebhookInfo')
    console.log(JSON.stringify({ webhook: webhook.url, pending: webhook.pending_update_count, lastErrorAt: webhook.last_error_date ?? null }))
    return
  }
  if (mode === 'users') {
    const webhook = await call('getWebhookInfo')
    if (webhook.url) throw new Error('Webhook já ativo. Os IDs autorizados estão na configuração privada; não desative o webhook para descobrir usuários.')
    const updates = await call('getUpdates', { timeout: 0, limit: 100, allowed_updates: ['message', 'callback_query'] })
    const users = new Map()
    for (const update of updates) {
      const msg = update.message, user = msg?.from
      if (msg?.chat?.type === 'private' && user && msg.chat.id === user.id) users.set(user.id, { id: user.id, username: user.username ?? null, firstName: user.first_name })
    }
    console.log(JSON.stringify({ users: [...users.values()], instruction: 'Confirme o seu usuário e coloque somente o seu ID em TELEGRAM_ADMIN_USER_IDS. Se não aparecer, abra o bot e pressione Iniciar.' }))
    return
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? ''
  const ids = (process.env.TELEGRAM_ADMIN_USER_IDS ?? '').split(',').map(x => x.trim())
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret) || ids.some(x => !/^\d+$/.test(x) || !Number.isSafeInteger(Number(x)) || Number(x) <= 0)) throw new Error('Preencha segredo forte e IDs permitidos antes de ativar.')
  const base = new URL(process.env.TELEGRAM_PUBLIC_BASE_URL || process.env.APP_URL || '')
  if (base.protocol !== 'https:' || base.username || base.password || base.port || base.pathname !== '/' || base.search || base.hash || ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Configure TELEGRAM_PUBLIC_BASE_URL como origem HTTPS pública, sem caminho.')
  const url = new URL('/api/webhooks/telegram', base).href
  const probe = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret }, body: '{}', signal: AbortSignal.timeout(15000) })
  if (!probe.ok) throw new Error(`O webhook ainda não está pronto na hospedagem (HTTP ${probe.status}). Publique código, aplique a migração e configure as variáveis privadas primeiro.`)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !key) throw new Error('Credenciais locais do banco ausentes; não foi possível verificar a migração.')
  for (const table of ['telegram_support_actions', 'telegram_support_updates']) {
    const r = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=0`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error('A migração privada do bot ainda não foi confirmada no banco.')
  }
  await call('setMyCommands', { commands: [{ command: 'start', description: 'Iniciar suporte privado' }, { command: 'help', description: 'Como consultar e corrigir acessos' }] })
  await call('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'], max_connections: 1, drop_pending_updates: false })
  const webhook = await call('getWebhookInfo')
  if (webhook.url !== url) throw new Error('Não foi possível confirmar o endereço do webhook.')
  console.log(JSON.stringify({ activated: true, webhook: url, pending: webhook.pending_update_count, allowedUserIds: ids.map(Number) }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
