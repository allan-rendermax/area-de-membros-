import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTelegramConfig } from '@/lib/telegram/config'
import { postTelegramWebhook } from '@/lib/telegram/webhook'
import { createTelegramClient, deliveryLabel, readProviderEmail } from '@/lib/telegram/client'

const config = { token: '123:private-token', secret: 'test-webhook-secret-1234567890123456', allowedUsers: [123], storeSlug: 'arquitetura' }
const update = { update_id: 1, message: { message_id: 1, from: { id: 123 }, chat: { id: 123, type: 'private' }, text: 'email@example.test' } }
const request = (data: unknown, secret = config.secret) => new Request('https://example.test/api/webhooks/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify(data) })
beforeEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('webhook privado', () => {
  it('usa autorização dinâmica em cada update e revogação vence a lista antiga', async () => {
    const process = vi.fn(), authorize = vi.fn().mockResolvedValue(false)
    await postTelegramWebhook(request(update), config, process, undefined, authorize)
    expect(process).not.toHaveBeenCalled()
    authorize.mockResolvedValue(true)
    const other = structuredClone(update); other.message.from.id = 456; other.message.chat.id = 456
    await postTelegramWebhook(request(other), config, process, undefined, authorize)
    expect(process).toHaveBeenCalledWith(other)
  })
  it('não consulta permissões com segredo errado e falha fechada quando o banco cai', async () => {
    const process = vi.fn(), authorize = vi.fn().mockRejectedValue(new Error('offline'))
    await postTelegramWebhook(request(update, 'wrong'), config, process, undefined, authorize)
    expect(authorize).not.toHaveBeenCalled()
    const response = await postTelegramWebhook(request(update), config, process, undefined, authorize)
    expect(response.status).toBe(503); expect(process).not.toHaveBeenCalled()
  })
  it('informa somente o próprio ID ao visitante no privado sem acessar clientes', async () => {
    const input = structuredClone(update); input.message.from.id = 999; input.message.chat.id = 999; input.message.text = '/id'
    const process = vi.fn(), identify = vi.fn()
    await postTelegramWebhook(request(input), config, process, identify)
    expect(identify).toHaveBeenCalledWith(999); expect(process).not.toHaveBeenCalled()
    identify.mockClear(); input.message.chat.type = 'group'
    await postTelegramWebhook(request(input), config, process, identify)
    expect(identify).not.toHaveBeenCalled()
  })
  it('configuração incompleta não ativa bot', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '')
    expect(getTelegramConfig()).toBeNull()
  })
  it('permite configuração somente com proprietário, sem lista legada', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', config.token); vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', config.secret)
    vi.stubEnv('TELEGRAM_ADMIN_USER_IDS', ''); vi.stubEnv('TELEGRAM_OWNER_USER_IDS', '123')
    vi.stubEnv('TELEGRAM_SUPPORT_STORE_SLUG', 'arquitetura')
    expect(getTelegramConfig()).toEqual(config)
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
  it('envia HTML já formatado e preserva botões', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true, result: { message_id: 1 } })); vi.stubGlobal('fetch', fetch)
    await createTelegramClient(config.token).send(123, '<b>&lt;cliente&gt;</b>', [[{ text: 'Ação', callback_data: 'resend:uuid' }]])
    const payload = JSON.parse(fetch.mock.calls[0][1].body)
    expect(payload.text).toBe('<b>&lt;cliente&gt;</b>'); expect(payload.parse_mode).toBe('HTML')
  })
  it('falha do provedor não vira entrega confirmada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private body', { status: 403 })))
    expect(await readProviderEmail('provider-id', 'private-key')).toBeNull()
    expect(deliveryLabel('sent')).toContain('aguardando'); expect(deliveryLabel('delivered')).toContain('servidor')
    expect(deliveryLabel('bounced')).toContain('devolvido')
  })
})

describe('edição de mensagens', () => {
  it('edita com HTML, remove botões e desliga preview', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true, result: { message_id: 7 } })); vi.stubGlobal('fetch', fetch)
    await createTelegramClient(config.token).edit(123, 7, '<b>Texto</b>')
    expect(fetch.mock.calls[0][0]).toContain('/editMessageText')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ chat_id:123, message_id:7, parse_mode:'HTML', reply_markup:{inline_keyboard:[]}, link_preview_options:{is_disabled:true} })
  })
  it('message is not modified é sucesso sem mensagem nova', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ok:false,description:'Bad Request: message is not modified'}, {status:400})); vi.stubGlobal('fetch',fetch)
    await expect(createTelegramClient(config.token).edit(123,7,'Texto')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('outra falha de edição envia nova mensagem preservando botões', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ok:false,description:'cannot edit'}, {status:400})).mockResolvedValueOnce(Response.json({ok:true,result:{message_id:8}})); vi.stubGlobal('fetch',fetch)
    const buttons = [[{text:'Confirmar',callback_data:'confirm:id',style:'success' as const}]]
    await createTelegramClient(config.token).edit(123,7,'Texto',buttons)
    expect(fetch.mock.calls[1][0]).toContain('/sendMessage')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({text:'Texto',parse_mode:'HTML',reply_markup:{inline_keyboard:buttons}})
  })
})
