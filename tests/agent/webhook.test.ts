import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentConfig } from '@/lib/agent/config'
import { handleZernioWebhook } from '@/lib/agent/webhook'
import { memoryRepository } from './memory-repository'

const config: AgentConfig = {
  zernioApiKey: 'test-key', webhookSecret: 'test-webhook-secret-1234567890123456',
  anthropicApiKey: 'test-anthropic', model: 'test-model',
  accountIds: ['6b05a6a49f8d271e5d1941a2', '6b05a8f01de1f94249e842e8'],
  storeSlug: 'arquitetura', batchSeconds: 8, dailyResendLimit: 20, quotaReserve: 30,
}
const at = new Date('2026-11-24T15:00:00.000Z')
afterEach(() => vi.restoreAllMocks())
function event() {
  return {
    id: 'event-1', event: 'message.received',
    message: { id: 'message-1', conversationId: 'conversation-1', platform: 'instagram', direction: 'incoming', text: 'Olá, não recebi 💛', sender: { id: 'sender-1', name: 'Cliente', username: 'cliente' } },
    conversation: { id: 'conversation-1' }, account: { id: config.accountIds[0] },
  }
}
function signed(body: string, signature = createHmac('sha256', config.webhookSecret).update(body).digest('hex'), headers: Record<string, string> = {}) {
  return new Request('https://example.test/api/webhooks/zernio', {
    method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-Zernio-Signature': signature, ...headers },
  })
}
function setup() {
  const memory = memoryRepository()
  const schedule = vi.fn<(conversationId: string, messageId: string) => void>()
  const after = vi.fn<(callback: () => Promise<void>) => void>()
  const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined)
  return { ...memory, deps: { config, storeId: 'store-1', repo: memory.repo, schedule, after, sleep, now: () => new Date(at) }, schedule, after, sleep }
}
function expectNoEffects(s: ReturnType<typeof setup>) {
  expect(s.conversations.size).toBe(0)
  expect(s.messages.size).toBe(0)
  expect(s.schedule).not.toHaveBeenCalled()
}
async function receive(s: ReturnType<typeof setup>) {
  await handleZernioWebhook(signed(JSON.stringify(event())), s.deps)
  s.schedule.mockClear()
}
function outgoing() {
  const input = event()
  input.event = 'message.sent'; input.message.direction = 'outgoing'
  input.message.id = 'outgoing-1'; input.message.text = 'Vou verificar'
  return input
}

describe('webhook Zernio', () => {
  it.each(['', 'invalid', '0'.repeat(64), 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(66)])('recusa assinatura inválida com 401: %s', async signature => {
    const s = setup()
    const response = await handleZernioWebhook(signed(JSON.stringify(event()), signature), s.deps)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'não autorizado' })
    expectNoEffects(s)
  })

  it('recusa assinatura ausente', async () => {
    const s = setup(), request = signed(JSON.stringify(event()))
    request.headers.delete('X-Zernio-Signature')
    expect((await handleZernioWebhook(request, s.deps)).status).toBe(401)
    expectNoEffects(s)
  })

  it('exige assinatura em hex minúsculo', async () => {
    const s = setup(), body = JSON.stringify(event())
    const signature = createHmac('sha256', config.webhookSecret).update(body).digest('hex').toUpperCase()
    expect((await handleZernioWebhook(signed(body, signature), s.deps)).status).toBe(401)
    expectNoEffects(s)
  })

  it('recusa corpo alterado depois de assinado', async () => {
    const s = setup(), body = JSON.stringify(event())
    const signature = createHmac('sha256', config.webhookSecret).update(body).digest('hex')
    expect((await handleZernioWebhook(signed(`${body} `, signature), s.deps)).status).toBe(401)
    expectNoEffects(s)
  })

  it('sem config retorna 503 antes de ler o corpo', async () => {
    const s = setup(), request = signed(JSON.stringify(event()))
    const read = vi.spyOn(request, 'arrayBuffer')
    expect((await handleZernioWebhook(request, { ...s.deps, config: null })).status).toBe(503)
    expect(read).not.toHaveBeenCalled()
    expectNoEffects(s)
  })

  it('grava mensagem recebida e agenda uma vez depois de persistir', async () => {
    const s = setup()
    s.schedule.mockImplementation(() => { expect(s.messages.has('message-1')).toBe(true) })
    const response = await handleZernioWebhook(signed(JSON.stringify(event(), null, 2)), s.deps)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(s.conversations.get('conversation-1')).toEqual({
      id: 'conversation-1', storeId: 'store-1', accountId: config.accountIds[0], platform: 'instagram',
      customerName: 'Cliente', state: 'active', pausedUntil: null, lastIncomingAt: at,
    })
    expect(s.messages.get('message-1')).toMatchObject({ id: 'message-1', author: 'cliente', direction: 'in', text: 'Olá, não recebi 💛', createdAt: at })
    expect(s.schedule).toHaveBeenCalledExactlyOnceWith('conversation-1', 'message-1')
  })

  it('mesmo webhook repetido não agenda de novo, mesmo com outro ID de evento', async () => {
    const s = setup(), input = event()
    await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)
    input.id = 'event-2'
    await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)
    expect(s.messages.size).toBe(1)
    expect(s.schedule).toHaveBeenCalledExactlyOnceWith('conversation-1', 'message-1')
  })

  it('webhooks simultâneos com mesmo ID de mensagem agendam uma vez', async () => {
    const s = setup(), body = JSON.stringify(event())
    await Promise.all([handleZernioWebhook(signed(body), s.deps), handleZernioWebhook(signed(body), s.deps)])
    expect(s.messages.size).toBe(1)
    expect(s.schedule).toHaveBeenCalledTimes(1)
  })

  it('ignora conta que não é da Marina', async () => {
    const s = setup(), input = event(); input.account.id = 'other-account'
    expect((await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)).status).toBe(200)
    expectNoEffects(s)
  })

  it('aceita a conta do Facebook configurada', async () => {
    const s = setup(), input = event()
    input.account.id = config.accountIds[1]; input.message.platform = 'facebook'
    await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)
    expect(s.conversations.get('conversation-1')).toMatchObject({ accountId: config.accountIds[1], platform: 'facebook' })
    expect(s.schedule).toHaveBeenCalledTimes(1)
  })

  it.each(['whatsapp', 'tiktok', ''])('ignora plataforma %s', async platform => {
    const s = setup(), input = event(); input.message.platform = platform
    expect((await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)).status).toBe(200)
    expectNoEffects(s)
  })

  it.each([null, {}, { event: 'message.received' }, { ...event(), message: { ...event().message, id: 42 } }, { ...event(), account: {} }])('ignora evento inválido: %j', async input => {
    const s = setup()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)).status).toBe(200)
    expect(log).toHaveBeenCalledExactlyOnceWith('agent_webhook_invalid_payload')
    expectNoEffects(s)
  })

  it.each(['message.deleted', 'conversation.updated'])('ignora evento %s', async kind => {
    const s = setup(), input = event(); input.event = kind
    expect((await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)).status).toBe(200)
    expectNoEffects(s)
  })

  it('ignora message.received com direção outgoing', async () => {
    const s = setup(), input = event(); input.message.direction = 'outgoing'
    await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)
    expectNoEffects(s)
  })

  it.each([
    { name: '', username: 'usuario', expected: 'usuario' },
    { name: undefined, username: undefined, expected: '' },
  ])('usa fallback do nome: $expected e sinaliza anexo sem texto', async ({ name, username, expected }) => {
    const s = setup(), input = { ...event(), message: { ...event().message, text: undefined, sender: { id: 'sender-1', name, username } } }
    await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)
    expect(s.conversations.get('conversation-1')?.customerName).toBe(expected)
    expect(s.messages.get('message-1')?.text).toBe('[anexo sem texto]')
    expect(s.schedule).toHaveBeenCalledTimes(1)
  })

  it('mensagem nova atualiza metadados e mantém pausa existente', async () => {
    const s = setup(); await receive(s)
    const until = new Date('2026-11-25T15:00:00Z')
    await s.repo.pauseConversation('conversation-1', until)
    const input = event(); input.message.id = 'message-2'; input.message.sender.name = 'Nome atualizado'
    await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)
    expect(s.conversations.get('conversation-1')).toMatchObject({ customerName: 'Nome atualizado', state: 'paused', pausedUntil: until })
    expect(s.schedule).toHaveBeenCalledExactlyOnceWith('conversation-1', 'message-2')
  })

  it('envio do próprio agente não pausa a conversa', async () => {
    const s = setup(); await receive(s)
    const input = outgoing()
    await s.repo.recordOutgoing({ id: input.message.id, conversationId: 'conversation-1', author: 'agente', text: input.message.text })
    await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)
    expect(s.after).toHaveBeenCalledTimes(1)
    await s.after.mock.calls[0][0]()
    expect(s.conversations.get('conversation-1')).toMatchObject({ state: 'active', pausedUntil: null })
    expect(s.messages.get('outgoing-1')?.author).toBe('agente')
    expect(s.messages.size).toBe(2)
    expect(s.schedule).not.toHaveBeenCalled()
  })

  it.each(['automationId', 'workflowId', 'broadcastId', 'sequenceId'])('envio automático com %s não pausa nem é gravado como Allan', async field => {
    const s = setup(); await receive(s)
    const input = outgoing()
    const message = { ...input.message, sentVia: 'automation', [field]: 'automatic-123' }
    await handleZernioWebhook(signed(JSON.stringify({ ...input, message })), s.deps)
    for (const [callback] of s.after.mock.calls) await callback()
    expect(s.conversations.get('conversation-1')?.state).toBe('active')
    expect(s.messages.has('outgoing-1')).toBe(false)
  })

  it.each([
    ['agente', 'conversation-1', -120000, '  Vou verificar \n', false],
    ['allan', 'conversation-1', -1000, 'Vou verificar', false],
    ['agente', 'other', -1000, 'Vou verificar', true],
    ['agente', 'conversation-1', -120001, 'Vou verificar', true],
    ['agente', 'conversation-1', -1000, 'Outro texto', true],
    ['cliente', 'conversation-1', -1000, 'Vou verificar', true],
  ] as const)('reconhece texto próprio só na mesma conversa por dois minutos (%s, %s, %s)', async (author, conversationId, age, text, paused) => {
    const s = setup(); await receive(s)
    s.messages.set('different-api-id', { id: 'different-api-id', conversationId, direction: author === 'cliente' ? 'in' : 'out', author, text, createdAt: new Date(at.getTime() + age) })
    await handleZernioWebhook(signed(JSON.stringify(outgoing())), s.deps)
    await s.after.mock.calls[0][0]()
    expect(s.conversations.get('conversation-1')?.state).toBe(paused ? 'paused' : 'active')
    expect(s.messages.has('outgoing-1')).toBe(paused)
  })

  it.each([null, '', '   '])('grava marcador para mídia com texto %j', async text => {
    const s = setup(), input = event()
    await handleZernioWebhook(signed(JSON.stringify({ ...input, message: { ...input.message, text } })), s.deps)
    expect(s.messages.get('message-1')?.text).toBe('[anexo sem texto]')
  })

  it('resposta do Allan pelo bot não pausa a conversa', async () => {
    const s = setup(); await receive(s)
    await s.repo.recordOutgoing({ id: 'outgoing-1', conversationId: 'conversation-1', author: 'allan', text: 'Resposta pelo bot' })
    await handleZernioWebhook(signed(JSON.stringify(outgoing())), s.deps)
    await s.after.mock.calls[0][0]()
    expect(s.conversations.get('conversation-1')).toMatchObject({ state: 'active', pausedUntil: null })
    expect(s.messages.get('outgoing-1')?.text).toBe('Resposta pelo bot')
    expect(s.schedule).not.toHaveBeenCalled()
  })

  it('envio feito pelo app pausa por 24 horas e grava como allan', async () => {
    const s = setup(); await receive(s)
    await handleZernioWebhook(signed(JSON.stringify(outgoing())), s.deps)
    expect(s.conversations.get('conversation-1')?.state).toBe('active')
    expect(s.messages.has('outgoing-1')).toBe(false)
    await s.after.mock.calls[0][0]()
    expect(s.sleep).toHaveBeenCalledExactlyOnceWith(10000)
    expect(s.conversations.get('conversation-1')).toMatchObject({ state: 'paused', pausedUntil: new Date('2026-11-25T15:00:00.000Z') })
    expect(s.messages.get('outgoing-1')).toMatchObject({ author: 'allan', direction: 'out', conversationId: 'conversation-1', text: 'Vou verificar' })
    expect(s.schedule).not.toHaveBeenCalled()
  })

  it('ignora envio feito pelo app quando a conversa ainda não existe', async () => {
    const s = setup()
    expect((await handleZernioWebhook(signed(JSON.stringify(outgoing())), s.deps)).status).toBe(200)
    expect(s.after).toHaveBeenCalledTimes(1)
    await s.after.mock.calls[0][0]()
    expectNoEffects(s)
  })

  it('envio do agente gravado depois do webhook não pausa', async () => {
    const s = setup(); await receive(s)
    let release!: () => void
    s.sleep.mockImplementation(() => new Promise<void>(resolve => { release = resolve }))
    expect((await handleZernioWebhook(signed(JSON.stringify(outgoing())), s.deps)).status).toBe(200)
    expect(s.after).toHaveBeenCalledTimes(1)
    const check = vi.spyOn(s.repo, 'isOwnOutgoing')
    const pending = s.after.mock.calls[0][0]()
    expect(check).not.toHaveBeenCalled()
    await s.repo.recordOutgoing({ id: 'outgoing-1', conversationId: 'conversation-1', author: 'agente', text: 'Resposta do agente' })
    release()
    await pending
    expect(s.sleep).toHaveBeenCalledExactlyOnceWith(10000)
    expect(check).toHaveBeenCalledExactlyOnceWith('outgoing-1', { conversationId: 'conversation-1', text: 'Vou verificar', since: new Date('2026-11-24T14:58:00Z') })
    expect(s.conversations.get('conversation-1')).toMatchObject({ state: 'active', pausedUntil: null })
    expect(s.messages.get('outgoing-1')?.author).toBe('agente')
  })

  it('message.sent sem sender ainda pausa quando não é do agente', async () => {
    const s = setup(); await receive(s)
    const input = outgoing()
    const message = { ...input.message, sender: undefined }
    expect((await handleZernioWebhook(signed(JSON.stringify({ ...input, message })), s.deps)).status).toBe(200)
    expect(s.after).toHaveBeenCalledTimes(1)
    await s.after.mock.calls[0][0]()
    expect(s.conversations.get('conversation-1')).toMatchObject({ state: 'paused', pausedUntil: new Date('2026-11-25T15:00:00Z') })
    expect(s.messages.get('outgoing-1')?.author).toBe('allan')
  })

  it('recusa Content-Length acima de 64 KB sem ler o corpo', async () => {
    const s = setup(), request = signed('{}', undefined, { 'Content-Length': '65537' })
    const read = vi.spyOn(request, 'arrayBuffer')
    expect((await handleZernioWebhook(request, s.deps)).status).toBe(413)
    expect(read).not.toHaveBeenCalled()
    expectNoEffects(s)
  })

  it('recusa mais de 64 KB reais sem Content-Length (conta bytes UTF-8)', async () => {
    const s = setup(), input = event(); input.message.text = 'á'.repeat(32768)
    expect((await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)).status).toBe(413)
    expectNoEffects(s)
  })

  it('aceita exatamente 64 KB', async () => {
    const s = setup(), input = event(); input.message.text = ''
    const base = JSON.stringify(input)
    input.message.text = 'a'.repeat(65536 - Buffer.byteLength(base))
    expect((await handleZernioWebhook(signed(JSON.stringify(input)), s.deps)).status).toBe(200)
    expect(s.schedule).toHaveBeenCalledTimes(1)
  })

  it('JSON malformado autenticado retorna 400 sem efeito', async () => {
    const s = setup()
    expect((await handleZernioWebhook(signed('{'), s.deps)).status).toBe(400)
    expectNoEffects(s)
  })

  it('falha do repositório retorna erro genérico sem agendar', async () => {
    const s = setup()
    s.repo.recordIncoming = async () => { throw new Error('private customer text') }
    const response = await handleZernioWebhook(signed(JSON.stringify(event())), s.deps)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'falha temporária' })
    expectNoEffects(s)
  })
})
