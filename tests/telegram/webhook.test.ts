import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTelegramConfig } from '@/lib/telegram/config'
import { postTelegramWebhook } from '@/lib/telegram/webhook'
import { createTelegramClient, deliveryLabel, readProviderEmail } from '@/lib/telegram/client'

const config = { token: '123:private-token', secret: 'test-webhook-secret-1234567890123456', allowedUsers: [123], storeSlug: 'arquitetura' }
const update = { update_id: 1, message: { message_id: 1, from: { id: 123 }, chat: { id: 123, type: 'private' }, text: 'email@example.test' } }
const request = (data: unknown, secret = config.secret) => new Request('https://example.test/api/webhooks/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify(data) })
beforeEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('webhook privado', () => {
  it('configuração incompleta não ativa bot', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '')
    expect(getTelegramConfig()).toBeNull()
  })
  it('exige IDs numéricos e segredo suficientemente longo', () => {
    vi.stubEnv('TELEGRAM_SUPPORT_STORE_SLUG', 'arquitetura')
    vi.stubEnv('TELEGRAM_BOT_TOKEN', config.token); vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', config.secret); vi.stubEnv('TELEGRAM_ADMIN_USER_IDS', 'username')
    expect(getTelegramConfig()).toBeNull()
    vi.stubEnv('TELEGRAM_ADMIN_USER_IDS', '123'); vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'weak')
    expect(getTelegramConfig()).toBeNull()
  })
  it('aceita configuração completa e remove IDs repetidos', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', config.token); vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', config.secret)
    vi.stubEnv('TELEGRAM_ADMIN_USER_IDS', '123,456,123'); vi.stubEnv('TELEGRAM_SUPPORT_STORE_SLUG', 'arquitetura')
    expect(getTelegramConfig()).toEqual({ ...config, allowedUsers: [123, 456] })
  })
  it('bot desativado não processa requisição', async () => {
    const process = vi.fn(); const r = await postTelegramWebhook(request(update), null, process)
    expect(r.status).toBe(503); expect(process).not.toHaveBeenCalled()
  })
  it('segredo errado nega antes de processar', async () => {
    const process = vi.fn(); const r = await postTelegramWebhook(request(update, 'wrong'), config, process)
    expect(r.status).toBe(401); expect(process).not.toHaveBeenCalled()
  })
  it.each(['unknown', 'group', 'invalid'])('ignora entrada %s antes de inicializar consultas', async kind => {
    const input = structuredClone(update)
    if (kind === 'unknown') { input.message.from.id = 999; input.message.chat.id = 999 }
    if (kind === 'group') input.message.chat.type = 'group'
    const process = vi.fn(); await postTelegramWebhook(request(kind === 'invalid' ? {} : input), config, process)
    expect(process).not.toHaveBeenCalled()
  })
  it('recusa corpo grande mesmo sem Content-Length', async () => {
    const process = vi.fn(); const r = await postTelegramWebhook(request({ text: 'x'.repeat(33000) }), config, process)
    expect(r.status).toBe(413); expect(process).not.toHaveBeenCalled()
  })
  it('processa update privado autorizado', async () => {
    const process = vi.fn(async () => {}); const r = await postTelegramWebhook(request(update), config, process)
    expect(r.status).toBe(200); expect(process).toHaveBeenCalledWith(update)
  })
})
describe('clientes HTTP e status', () => {
  it('não expõe token ou resposta bruta em erro de transporte', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('https://api.telegram.org/bot123:private-token/getMe')))
    await expect(createTelegramClient(config.token).send(123, 'test')).rejects.toThrow('telegram_request_failed')
  })
  it('envia botões sem interpretar dados do cliente como HTML', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true, result: { message_id: 1 } })); vi.stubGlobal('fetch', fetch)
    await createTelegramClient(config.token).send(123, '<cliente>', [[{ text: 'Ação', callback_data: 'open:uuid' }]])
    const payload = JSON.parse(fetch.mock.calls[0][1].body)
    expect(payload.text).toBe('<cliente>'); expect(payload.parse_mode).toBeUndefined()
  })
  it('falha do provedor não vira entrega confirmada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private body', { status: 403 })))
    expect(await readProviderEmail('provider-id', 'private-key')).toBeNull()
    expect(deliveryLabel('sent')).toContain('aguardando'); expect(deliveryLabel('delivered')).toContain('servidor')
    expect(deliveryLabel('bounced')).toContain('devolvido')
  })
})
