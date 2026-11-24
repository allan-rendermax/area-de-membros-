import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { runAgent, type AgentTools, type CallModel } from '@/lib/agent/brain'
import type { AgentConfig } from '@/lib/agent/config'
import { createEscalate } from '@/lib/agent/escalation'
import { processConversation } from '@/lib/agent/process'
import type { AgentConversation } from '@/lib/agent/types'
import { memoryRepository } from './memory-repository'

const now = new Date('2026-11-25T01:30:00Z') // Ainda 24/11 em São Paulo.
const config: AgentConfig = {
  zernioApiKey: 'test', webhookSecret: 'x'.repeat(32), anthropicApiKey: 'test', model: 'test',
  accountIds: ['account-1'], storeSlug: 'test-store', batchSeconds: 8, dailyResendLimit: 20, quotaReserve: 30,
}
const input = { conversationId: 'conversation-1', messageId: 'incoming-1' }
const answer: BetaMessage = {
  id: 'model-1', type: 'message', role: 'assistant', model: 'test',
  content: [{ type: 'tool_use', id: 'reply-1', name: 'responder', input: { texto: 'Resposta do banco' } }],
  stop_reason: 'tool_use', stop_sequence: null, stop_details: null, container: null,
  context_management: null, diagnostics: null,
  usage: {
    input_tokens: 10, output_tokens: 5, cache_creation: null, cache_creation_input_tokens: null,
    cache_read_input_tokens: null, fallback_credit: null, inference_geo: null, iterations: null,
    output_tokens_details: null, server_tool_use: null, service_tier: null, speed: null,
  },
}

async function setup() {
  const memory = memoryRepository()
  memory.repo.isEnabled = vi.fn(async () => true)
  const telegram = vi.fn(async () => 123)
  const escalate = vi.fn(createEscalate({ send: telegram }, [42], memory.repo))
  const zernio = { send: vi.fn(async () => ({ messageId: 'outgoing-1' })) }
  const tools: AgentTools = {
    buscar_compra: vi.fn(), reenviar_acesso: vi.fn(), escalar: vi.fn(),
    async responder(text) {
      const { messageId } = await zernio.send()
      await memory.repo.recordOutgoing({ id: messageId, conversationId: input.conversationId, author: 'agente', text })
      memory.messages.get(messageId)!.createdAt = new Date(now.getTime() + 10)
      return { ok: true }
    },
  }
  const deps = {
    repo: memory.repo, zernio, brain: vi.fn(runAgent),
    callModel: vi.fn<CallModel>().mockResolvedValue(answer),
    buildTools: vi.fn<(conversation: AgentConversation) => Promise<AgentTools>>(async () => tools), escalate,
    sleep: vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined), now: () => new Date(now), config, storeId: 'store-1',
  }
  async function incoming(id = input.messageId, text = 'Preciso de ajuda', at = now) {
    await memory.repo.recordIncoming({
      id, text, at, conversationId: input.conversationId, storeId: 'store-1', accountId: 'account-1',
      platform: 'instagram', customerName: 'Cliente fictício',
    })
  }
  await incoming()
  return { ...memory, deps, incoming, telegram, escalate, zernio }
}

function expectNoReply(s: Awaited<ReturnType<typeof setup>>) {
  expect(s.zernio.send).not.toHaveBeenCalled()
  expect(s.deps.brain).not.toHaveBeenCalled()
  expect(s.deps.buildTools).not.toHaveBeenCalled()
}

afterEach(() => vi.restoreAllMocks())

describe('processamento da conversa', () => {
  it('três mensagens seguidas geram uma resposta', async () => {
    const s = await setup()
    const sleepers: (() => void)[] = []
    s.deps.sleep.mockImplementation(() => new Promise<void>(resolve => { sleepers.push(resolve) }))
    const first = processConversation(input, s.deps)
    await s.incoming('incoming-2', 'Comprei', new Date(now.getTime() + 1))
    const second = processConversation({ ...input, messageId: 'incoming-2' }, s.deps)
    await s.incoming('incoming-3', 'Não recebi', new Date(now.getTime() + 2))
    const third = processConversation({ ...input, messageId: 'incoming-3' }, s.deps)
    expect(s.deps.brain).not.toHaveBeenCalled()
    sleepers.forEach(resolve => resolve())
    expect(await Promise.all([first, second, third])).toEqual(['ignorado', 'ignorado', 'respondido'])
    expect(s.deps.sleep.mock.calls).toEqual([[8000], [8000], [8000]])
    expect(s.zernio.send).toHaveBeenCalledTimes(1)
    expect(s.deps.brain.mock.calls[0][0].messages.map(m => m.text)).toEqual(['Preciso de ajuda', 'Comprei', 'Não recebi'])
  })

  it('conversa escalada não responde e avisa o Telegram', async () => {
    const s = await setup()
    await s.repo.setState(input.conversationId, 'escalated')
    expect(await processConversation(input, s.deps)).toBe('escalado')
    expect(s.escalate).toHaveBeenCalledWith(expect.objectContaining({ reason: 'continuacao', summary: 'Preciso de ajuda' }))
    expect(s.telegram).toHaveBeenCalledTimes(1)
    expectNoReply(s)
  })

  it('conversa pausada pelo Allan é ignorada', async () => {
    const s = await setup()
    await s.repo.pauseConversation(input.conversationId, new Date(now.getTime() + 1))
    expect(await processConversation(input, s.deps)).toBe('ignorado')
    expect(s.escalate).not.toHaveBeenCalled()
    expectNoReply(s)
  })

  it.each([-1, 0])('pausa expirada há %i ms volta a active antes de criar ferramentas', async offset => {
    const s = await setup()
    await s.repo.pauseConversation(input.conversationId, new Date(now.getTime() + offset))
    s.deps.buildTools.mockImplementation(async conversation => {
      expect(conversation).toMatchObject({ state: 'active', pausedUntil: null })
      expect(await s.repo.getConversation(input.conversationId)).toMatchObject({ state: 'active', pausedUntil: null })
      return { buscar_compra: vi.fn(), reenviar_acesso: vi.fn(), escalar: vi.fn(), responder: vi.fn().mockResolvedValue({ ok: true }) }
    })
    expect(await processConversation(input, s.deps)).toBe('respondido')
  })

  it('fora da janela escala sem responder', async () => {
    const s = await setup()
    await s.incoming('old', 'Mensagem antiga', new Date(now.getTime() - 86400001))
    s.messages.delete(input.messageId)
    expect(await processConversation({ ...input, messageId: 'old' }, s.deps)).toBe('escalado')
    expect(s.escalate).toHaveBeenCalledWith(expect.objectContaining({ reason: 'fora_da_janela', summary: 'Mensagem antiga' }))
    expect(s.telegram).toHaveBeenCalledTimes(1)
    expectNoReply(s)
  })

  it('exatamente 24 horas ainda permite responder', async () => {
    const s = await setup()
    s.conversations.get(input.conversationId)!.lastIncomingAt = new Date(now.getTime() - 86400000)
    expect(await processConversation(input, s.deps)).toBe('respondido')
    expect(s.zernio.send).toHaveBeenCalledTimes(1)
  })

  it('agente desligado escala', async () => {
    const s = await setup()
    s.deps.repo.isEnabled = vi.fn(async () => false)
    await s.repo.pauseConversation(input.conversationId, new Date(now.getTime() + 60000))
    expect(await processConversation(input, s.deps)).toBe('escalado')
    expect(s.deps.repo.isEnabled).toHaveBeenCalledExactlyOnceWith('store-1')
    expect(s.escalate).toHaveBeenCalledWith(expect.objectContaining({ reason: 'agente_pausado', summary: 'Preciso de ajuda' }))
    expect(s.telegram).toHaveBeenCalledTimes(1)
    expectNoReply(s)
  })

  it('agente desligado ignora execução obsoleta antes de escalar', async () => {
    const s = await setup()
    s.deps.repo.isEnabled = vi.fn(async () => false)
    await s.incoming('new', 'Mais uma', new Date(now.getTime() + 1))
    expect(await processConversation(input, s.deps)).toBe('ignorado')
    expect(s.escalate).not.toHaveBeenCalled()
    expectNoReply(s)
  })

  it('continuação tem prioridade sobre fora da janela', async () => {
    const s = await setup()
    await s.repo.setState(input.conversationId, 'escalated')
    s.conversations.get(input.conversationId)!.lastIncomingAt = new Date(now.getTime() - 86400001)
    expect(await processConversation(input, s.deps)).toBe('escalado')
    expect(s.escalate).toHaveBeenCalledWith(expect.objectContaining({ reason: 'continuacao' }))
    expectNoReply(s)
  })

  it('não responde duas vezes sem nova mensagem do cliente', async () => {
    const s = await setup()
    expect(await processConversation(input, s.deps)).toBe('respondido')
    expect(await processConversation(input, s.deps)).toBe('ignorado')
    expect(s.zernio.send).toHaveBeenCalledTimes(1)
    expect(s.deps.brain).toHaveBeenCalledTimes(1)
  })

  it('nova mensagem do cliente depois do agente permite resposta', async () => {
    const s = await setup()
    await s.repo.recordOutgoing({ id: 'previous', conversationId: input.conversationId, author: 'agente', text: 'Oi' })
    s.messages.get('previous')!.createdAt = new Date(now.getTime() - 1)
    expect(await processConversation(input, s.deps)).toBe('respondido')
    expect(s.zernio.send).toHaveBeenCalledTimes(1)
  })

  it('monta só últimas 12 mensagens, papéis, conhecimento e data de São Paulo', async () => {
    const s = await setup()
    s.messages.clear()
    for (let i = 0; i < 15; i++) {
      const author = i % 3 === 0 ? 'allan' : i % 3 === 1 ? 'agente' : 'cliente'
      s.messages.set(`m-${i}`, {
        id: `m-${i}`, conversationId: input.conversationId, text: `Texto ${i}`, author,
        direction: author === 'cliente' ? 'in' : 'out', createdAt: new Date(now.getTime() - 15 + i),
      })
    }
    s.conversations.get(input.conversationId)!.platform = 'facebook'
    s.repo.knowledge = vi.fn(async () => [{ id: 'k-1', topic: 'Teste', rule: 'Regra cadastrada' }])
    expect(await processConversation({ ...input, messageId: 'm-14' }, s.deps)).toBe('respondido')
    const args = s.deps.brain.mock.calls[0][0]
    expect(args.messages).toEqual([
      { role: 'assistant', text: 'Texto 3' }, { role: 'assistant', text: 'Texto 4' }, { role: 'user', text: 'Texto 5' },
      { role: 'assistant', text: 'Texto 6' }, { role: 'assistant', text: 'Texto 7' }, { role: 'user', text: 'Texto 8' },
      { role: 'assistant', text: 'Texto 9' }, { role: 'assistant', text: 'Texto 10' }, { role: 'user', text: 'Texto 11' },
      { role: 'assistant', text: 'Texto 12' }, { role: 'assistant', text: 'Texto 13' }, { role: 'user', text: 'Texto 14' },
    ])
    expect(args.system).toContain('Teste: Regra cadastrada')
    expect(args.system).toContain('Data de hoje: 24/11/2026')
    expect(args.system).toContain('Plataforma: facebook')
    expect(s.repo.knowledge).toHaveBeenCalledExactlyOnceWith('store-1')
    expect(s.deps.buildTools).toHaveBeenCalledWith(expect.objectContaining({ id: input.conversationId, platform: 'facebook' }))
  })

  it.each([
    [{ replied: true, escalated: false }, 'respondido'],
    [{ replied: false, escalated: true }, 'escalado'],
    [{ replied: true, escalated: true }, 'escalado'],
    [{ replied: false, escalated: false }, 'ignorado'],
  ] as const)('converte resultado %j em %s', async (result, expected) => {
    const s = await setup()
    s.deps.brain.mockResolvedValue(result)
    expect(await processConversation(input, s.deps)).toBe(expected)
  })

  it('falha do cérebro tenta última escalação por erro_interno', async () => {
    const s = await setup()
    s.deps.brain.mockRejectedValue(new Error('texto privado'))
    expect(await processConversation(input, s.deps)).toBe('escalado')
    expect(s.escalate).toHaveBeenCalledExactlyOnceWith({
      conversation: expect.objectContaining({ id: input.conversationId }),
      reason: 'erro_interno', summary: 'Preciso de ajuda', recent: [expect.objectContaining({ id: input.messageId })],
    })
    expect(s.telegram).toHaveBeenCalledTimes(1)
    expect(s.zernio.send).not.toHaveBeenCalled()
  })

  it('falha da última escalação é engolida e log não inclui dados do cliente', async () => {
    const s = await setup()
    s.deps.brain.mockRejectedValue(new Error('cliente@example.test texto privado'))
    s.escalate.mockRejectedValue(new Error('Cliente fictício'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await processConversation(input, s.deps)).toBe('ignorado')
    expect(s.escalate).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledExactlyOnceWith('agent_process_failed')
  })

  it.each(['ausente', 'outra loja', 'sem histórico', 'sem mensagem recebida'])('ignora contexto %s', async kind => {
    const s = await setup()
    if (kind === 'ausente') s.conversations.clear()
    if (kind === 'outra loja') s.conversations.get(input.conversationId)!.storeId = 'other-store'
    if (kind === 'sem histórico') s.messages.clear()
    if (kind === 'sem mensagem recebida') s.messages.get(input.messageId)!.author = 'agente'
    expect(await processConversation(input, s.deps)).toBe('ignorado')
    expect(s.escalate).not.toHaveBeenCalled()
    expectNoReply(s)
  })
})
