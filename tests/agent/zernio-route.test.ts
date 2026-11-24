import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentConfig } from '@/lib/agent/config'
import { memoryRepository } from './memory-repository'
import { POST, maxDuration, runtime } from '@/app/api/webhooks/zernio/route'

const mocks = vi.hoisted(() => ({
  config: vi.fn(), store: vi.fn(), repository: vi.fn(),
  after: vi.fn<(callback: () => Promise<void>) => void>(), process: vi.fn(), sleep: vi.fn(),
}))
vi.mock('@/lib/agent/config', () => ({ getAgentConfig: mocks.config }))
vi.mock('@/lib/data/stores', () => ({ getStoreBySlug: mocks.store }))
vi.mock('@/lib/agent/repository', () => ({ createAgentRepository: mocks.repository }))
vi.mock('@/lib/agent/process', () => ({ processConversation: mocks.process, processConversationReal: mocks.process }))
vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('node:timers/promises', () => ({ setTimeout: mocks.sleep }))

const config: AgentConfig = {
  zernioApiKey: 'test-key', webhookSecret: 'test-webhook-secret-1234567890123456',
  anthropicApiKey: 'test-anthropic', model: 'test-model', accountIds: ['account-1'],
  storeSlug: 'configured-store', batchSeconds: 8, dailyResendLimit: 20, quotaReserve: 30,
}
function request(sent = false) {
  const body = JSON.stringify({
    id: 'event-1', event: sent ? 'message.sent' : 'message.received',
    message: { id: sent ? 'sent-1' : 'message-1', conversationId: 'conversation-1', platform: 'instagram', direction: sent ? 'outgoing' : 'incoming', text: 'Oi', sender: sent ? undefined : { id: 'customer-1', name: 'Cliente' } },
    conversation: { id: 'conversation-1' }, account: { id: 'account-1' },
  })
  return new Request('https://example.test/api/webhooks/zernio', { method: 'POST', body, headers: { 'X-Zernio-Signature': createHmac('sha256', config.webhookSecret).update(body).digest('hex') } })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.config.mockReturnValue(config)
  mocks.store.mockResolvedValue({ id: 'resolved-store-id' })
  mocks.repository.mockReturnValue(memoryRepository().repo)
  mocks.process.mockResolvedValue(undefined)
  mocks.sleep.mockResolvedValue(undefined)
})

describe('rota Zernio', () => {
  it('sem config retorna 503 sem inicializar banco nem agendar', async () => {
    mocks.config.mockReturnValue(null)
    expect((await POST(request())).status).toBe(503)
    expect(mocks.store).not.toHaveBeenCalled()
    expect(mocks.repository).not.toHaveBeenCalled()
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('loja inexistente retorna 503', async () => {
    mocks.store.mockResolvedValue(null)
    expect((await POST(request())).status).toBe(503)
    expect(mocks.store).toHaveBeenCalledExactlyOnceWith('configured-store')
    expect(mocks.repository).not.toHaveBeenCalled()
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('falha na consulta da loja retorna 503 genérico', async () => {
    mocks.store.mockRejectedValue(new Error('private database details'))
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'loja indisponível' })
    expect(mocks.repository).not.toHaveBeenCalled()
  })

  it('persiste com a loja resolvida e só processa quando after executar', async () => {
    const memory = memoryRepository(); mocks.repository.mockReturnValue(memory.repo)
    expect((await POST(request())).status).toBe(200)
    expect(memory.conversations.get('conversation-1')?.storeId).toBe('resolved-store-id')
    expect(memory.messages.get('message-1')?.author).toBe('cliente')
    expect(mocks.after).toHaveBeenCalledTimes(1)
    expect(mocks.process).not.toHaveBeenCalled()
    await mocks.after.mock.calls[0][0]()
    expect(mocks.process).toHaveBeenCalledExactlyOnceWith(
      { conversationId: 'conversation-1', messageId: 'message-1' }, { config, storeId: 'resolved-store-id' },
    )
    expect(runtime).toBe('nodejs')
    expect(maxDuration).toBe(300)
  })

  it('webhook repetido não registra outro callback em after', async () => {
    await POST(request()); await POST(request())
    expect(mocks.after).toHaveBeenCalledTimes(1)
  })

  it('message.sent sem sender retorna antes de esperar e só pausa em after', async () => {
    const memory = memoryRepository(); mocks.repository.mockReturnValue(memory.repo)
    await POST(request())
    mocks.after.mockClear()
    expect((await POST(request(true))).status).toBe(200)
    expect(mocks.sleep).not.toHaveBeenCalled()
    expect(memory.conversations.get('conversation-1')?.state).toBe('active')
    expect(memory.messages.has('sent-1')).toBe(false)
    expect(mocks.after).toHaveBeenCalledTimes(1)
    await mocks.after.mock.calls[0][0]()
    expect(mocks.sleep).toHaveBeenCalledExactlyOnceWith(10000)
    expect(memory.conversations.get('conversation-1')?.state).toBe('paused')
    expect(memory.messages.get('sent-1')?.author).toBe('allan')
    expect(mocks.process).not.toHaveBeenCalled()
  })

  it('falha ao construir repositório retorna 500 genérico', async () => {
    mocks.repository.mockImplementation(() => { throw new Error('private environment details') })
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'falha temporária' })
    expect(mocks.after).not.toHaveBeenCalled()
  })
})
