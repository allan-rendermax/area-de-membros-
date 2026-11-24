import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AgentConfig } from '@/lib/agent/config'
import { processConversationReal } from '@/lib/agent/process'
import { memoryRepository } from './memory-repository'

const mocks = vi.hoisted(() => ({
  repository: vi.fn(), zernio: vi.fn(), callModel: vi.fn(), brain: vi.fn(),
  buildTools: vi.fn(), escalateFactory: vi.fn(), escalate: vi.fn(), sleep: vi.fn(),
}))
vi.mock('@/lib/agent/repository', () => ({ createAgentRepository: mocks.repository }))
vi.mock('@/lib/agent/zernio', () => ({ createZernioClient: mocks.zernio }))
vi.mock('@/lib/agent/brain', () => ({ createCallModel: mocks.callModel, runAgent: mocks.brain }))
vi.mock('@/lib/agent/tools', () => ({ createRealAgentTools: mocks.buildTools }))
vi.mock('@/lib/agent/escalation', () => ({ createRealEscalate: mocks.escalateFactory }))
vi.mock('node:timers/promises', () => ({ setTimeout: mocks.sleep }))

const config: AgentConfig = {
  zernioApiKey: 'test-zernio', webhookSecret: 'x'.repeat(32), anthropicApiKey: 'test-anthropic', model: 'configured-model',
  accountIds: ['account-1'], storeSlug: 'configured-store', batchSeconds: 3, dailyResendLimit: 20, quotaReserve: 30,
}
const input = { conversationId: 'conversation-1', messageId: 'incoming-1' }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.sleep.mockResolvedValue(undefined)
  mocks.brain.mockResolvedValue({ replied: true, escalated: false })
  mocks.escalateFactory.mockReturnValue(mocks.escalate)
  mocks.escalate.mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())

async function setup() {
  const memory = memoryRepository()
  memory.repo.isEnabled = vi.fn(async () => true)
  await memory.repo.recordIncoming({
    id: input.messageId, conversationId: input.conversationId, storeId: 'store-1', accountId: 'account-1',
    platform: 'instagram', customerName: 'Cliente fictício', text: 'Oi', at: new Date(),
  })
  mocks.repository.mockReturnValue(memory.repo)
  return memory
}

it('versão real compõe o processamento com config e loja resolvidas sem rede', async () => {
  await setup()
  const tools = { responder: vi.fn(), escalar: vi.fn(), buscar_compra: vi.fn(), reenviar_acesso: vi.fn() }
  const callModel = vi.fn()
  mocks.buildTools.mockResolvedValue(tools)
  mocks.callModel.mockReturnValue(callModel)
  expect(await processConversationReal(input, { config, storeId: 'store-1' })).toBe('respondido')
  expect(mocks.sleep).toHaveBeenCalledExactlyOnceWith(3000)
  expect(mocks.zernio).toHaveBeenCalledExactlyOnceWith('test-zernio')
  expect(mocks.callModel).toHaveBeenCalledExactlyOnceWith('test-anthropic', 'configured-model')
  expect(mocks.buildTools).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: input.conversationId, storeId: 'store-1' }))
  expect(mocks.brain).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ tools, callModel }))
  expect(mocks.escalateFactory).not.toHaveBeenCalled()
})

it('versão real resolve escalação direta quando o agente está desligado', async () => {
  const s = await setup()
  s.repo.isEnabled = async () => false
  expect(await processConversationReal(input, { config, storeId: 'store-1' })).toBe('escalado')
  expect(mocks.escalateFactory).toHaveBeenCalledTimes(1)
  expect(mocks.escalate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ reason: 'agente_pausado', summary: 'Oi' }))
  expect(mocks.buildTools).not.toHaveBeenCalled()
  expect(mocks.brain).not.toHaveBeenCalled()
})

it('versão real contém falhas de infraestrutura e registra apenas código estático', async () => {
  mocks.repository.mockImplementation(() => { throw new Error('cliente@example.test') })
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(await processConversationReal(input, { config, storeId: 'store-1' })).toBe('ignorado')
  expect(log).toHaveBeenCalledExactlyOnceWith('agent_process_failed')
})
