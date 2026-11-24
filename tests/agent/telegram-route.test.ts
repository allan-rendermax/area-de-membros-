import { beforeEach, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/webhooks/telegram/route'
import { telegramUpdateSchema } from '@/lib/telegram/handler'

const h = vi.hoisted(() => ({
  team: vi.fn(), support: vi.fn(), agent: vi.fn(), config: vi.fn(), store: vi.fn(),
  agentRepo: vi.fn(), zernio: vi.fn(), learn: vi.fn(),
}))
vi.mock('@/lib/telegram/config', () => ({ getTelegramConfig: () => ({ token: 'test-token', secret: 'secret', storeSlug: 'support-store', allowedUsers: [123, 456] }) }))
vi.mock('@/lib/telegram/client', () => ({ createTelegramClient: () => ({ send: vi.fn(), edit: vi.fn(), ack: vi.fn() }) }))
vi.mock('@/lib/telegram/repository', () => ({ createSupportRepository: () => ({ acceptUpdate: vi.fn() }) }))
vi.mock('@/lib/telegram/team-repository', () => ({ createTeamRepository: () => ({}) }))
vi.mock('@/lib/telegram/team-access', () => ({ teamOwners: () => [123], isSupportUser: async () => true }))
vi.mock('@/lib/telegram/team', () => ({ handleTeamUpdate: h.team }))
vi.mock('@/lib/telegram/handler', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/telegram/handler')>(), handleTelegramUpdate: h.support }))
vi.mock('@/lib/telegram/platform', () => ({ createPlatformOperations: async () => ({}) }))
vi.mock('@/lib/telegram/monitoring-server', () => ({ listFailures: vi.fn() }))
vi.mock('@/lib/agent/config', () => ({ getAgentConfig: h.config }))
vi.mock('@/lib/agent/telegram', () => ({ handleAgentTelegram: h.agent }))
vi.mock('@/lib/agent/repository', () => ({ createAgentRepository: h.agentRepo }))
vi.mock('@/lib/agent/zernio', () => ({ createZernioClient: h.zernio }))
vi.mock('@/lib/agent/learn', () => ({ createLearn: h.learn }))
vi.mock('@/lib/data/stores', () => ({ getStoreBySlug: h.store }))

const agentConfig = { storeSlug: 'agent-store', zernioApiKey: 'zernio-key', anthropicApiKey: 'model-key', model: 'test-model' }
function input(owner = 123) {
  return { update_id: 1, message: { message_id: 20, from: { id: owner }, chat: { id: owner, type: 'private' }, text: '/agente status' } }
}
function request(value = input()) {
  return new Request('https://example.test/api/webhooks/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'secret' }, body: JSON.stringify(value) })
}
beforeEach(() => {
  vi.resetAllMocks()
  h.team.mockResolvedValue(false)
  h.agent.mockResolvedValue(true)
  h.config.mockReturnValue(agentConfig)
  h.store.mockResolvedValue({ id: 'resolved-agent-store' })
  h.agentRepo.mockReturnValue({ agent: 'repo' })
  h.zernio.mockReturnValue({ agent: 'zernio' })
  h.learn.mockReturnValue(vi.fn())
})

it('dono entra no agente depois da equipe e usa a loja da configuração do agente', async () => {
  expect((await POST(request())).status).toBe(200)
  expect(h.agent).toHaveBeenCalledExactlyOnceWith(telegramUpdateSchema.parse(input()), expect.objectContaining({
    owners: [123], storeId: 'resolved-agent-store', repo: { agent: 'repo' }, zernio: { agent: 'zernio' }, learn: expect.any(Function), now: expect.any(Function),
  }))
  expect(h.store).toHaveBeenCalledExactlyOnceWith('agent-store')
  expect(h.zernio).toHaveBeenCalledExactlyOnceWith('zernio-key')
  expect(h.learn).toHaveBeenCalledExactlyOnceWith('model-key', 'test-model')
  expect(h.team.mock.invocationCallOrder[0]).toBeLessThan(h.agent.mock.invocationCallOrder[0])
  expect(h.support).not.toHaveBeenCalled()
})

it('operador que não é dono nunca entra no handler do agente', async () => {
  expect((await POST(request(input(456)))).status).toBe(200)
  expect(h.agent).not.toHaveBeenCalled()
  expect(h.agentRepo).not.toHaveBeenCalled()
  expect(h.support).toHaveBeenCalledTimes(1)
})

it('sem configuração mantém o bot de suporte normal', async () => {
  h.config.mockReturnValue(null)
  expect((await POST(request())).status).toBe(200)
  expect(h.agent).not.toHaveBeenCalled()
  expect(h.store).not.toHaveBeenCalled()
  expect(h.support).toHaveBeenCalledTimes(1)
})

it('agente retorna false e o bot anterior trata o update', async () => {
  h.agent.mockResolvedValue(false)
  expect((await POST(request())).status).toBe(200)
  expect(h.support).toHaveBeenCalledTimes(1)
  expect(h.agent.mock.invocationCallOrder[0]).toBeLessThan(h.support.mock.invocationCallOrder[0])
})

it('equipe tratada encerra antes do agente ou suporte', async () => {
  h.team.mockResolvedValue(true)
  expect((await POST(request())).status).toBe(200)
  expect(h.agent).not.toHaveBeenCalled()
  expect(h.config).not.toHaveBeenCalled()
  expect(h.support).not.toHaveBeenCalled()
})

it('callback de dono também entra no handler do agente', async () => {
  const value = { update_id: 2, callback_query: { id: 'cb', from: { id: 123 }, data: 'agk:off:00000000-0000-4000-8000-000000000008', message: { message_id: 30, chat: { id: 123, type: 'private' } } } }
  const req = new Request('https://example.test/api/webhooks/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'secret' }, body: JSON.stringify(value) })
  expect((await POST(req)).status).toBe(200)
  expect(h.agent).toHaveBeenCalledWith(telegramUpdateSchema.parse(value), expect.any(Object))
  expect(h.support).not.toHaveBeenCalled()
})

it('loja ausente falha sem invocar o agente com outro storeId', async () => {
  h.store.mockResolvedValue(null)
  const response = await POST(request())
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: 'falha temporária' })
  expect(h.agent).not.toHaveBeenCalled()
})
