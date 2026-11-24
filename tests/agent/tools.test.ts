import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAgentTools } from '@/lib/agent/tools'
import { runAgent, type CallModel } from '@/lib/agent/brain'
import { createEscalate, type Escalate } from '@/lib/agent/escalation'
import type { AgentConversation, AgentMessage } from '@/lib/agent/types'
import type { ZernioClient } from '@/lib/agent/zernio'
import type { createPurchaseTools } from '@/lib/agent/purchase'
import { memoryRepository } from './memory-repository'

const now = new Date('2026-11-24T16:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('unexpected_network') }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

async function setup() {
  const memory = memoryRepository()
  await memory.repo.recordIncoming({
    id: 'incoming-1', conversationId: 'conversation', storeId: 'store', accountId: 'account',
    platform: 'instagram', customerName: 'Ana', text: 'Preciso de ajuda', at: now,
  })
  const conversation = (await memory.repo.getConversation('conversation'))!
  const send = vi.fn<ZernioClient['send']>().mockImplementation(async () => ({ messageId: `out-${memory.messages.size}` }))
  let telegramMessages = 0
  const io = { send: vi.fn<(chatId: number, text: string) => Promise<number>>().mockImplementation(async () => 101 * ++telegramMessages) }
  const purchase = {
    findPurchase: vi.fn<ReturnType<typeof createPurchaseTools>['findPurchase']>().mockResolvedValue({ found: false }),
    resendAccess: vi.fn<ReturnType<typeof createPurchaseTools>['resendAccess']>().mockResolvedValue({ ok: true }),
  }
  const escalate = createEscalate(io, [11, 22], memory.repo)
  const deps = { conversation, zernio: { send }, repo: memory.repo, purchase, escalate }
  return { ...memory, conversation, send, io, purchase, deps, tools: createAgentTools(deps) }
}

describe('ferramentas do agente', () => {
  it('responder envia pela Zernio e grava saída do agente', async () => {
    const s = await setup()
    s.send.mockImplementationOnce(async input => {
      expect(s.messages.size).toBe(1)
      expect(input).toEqual({ conversationId: 'conversation', accountId: 'account', text: 'Posso te ajudar 💛' })
      return { messageId: 'reply' }
    })
    expect(await s.tools.responder('Posso te ajudar 💛')).toEqual({ ok: true })
    expect(s.messages.get('reply')).toEqual({
      id: 'reply', conversationId: 'conversation', direction: 'out', author: 'agente', text: 'Posso te ajudar 💛', createdAt: now,
    })
  })

  it('propaga erro de envio sem gravar saída', async () => {
    const s = await setup()
    const error = new Error('zernio_send_failed')
    s.send.mockRejectedValueOnce(error)
    await expect(s.tools.responder('Olá')).rejects.toBe(error)
    expect(s.messages.size).toBe(1)
  })

  it('segundo e-mail não encontrado instrui escalar', async () => {
    const s = await setup()
    expect(await s.tools.buscar_compra('primeiro@example.test')).toEqual({ found: false })
    // New tool context: the counter belongs to the repository, not the closure.
    const next = createAgentTools(s.deps)
    expect(await next.buscar_compra('segundo@example.test')).toEqual({ found: false, instrucao: 'escalar' })
    expect(await next.buscar_compra('terceiro@example.test')).toEqual({ found: false, instrucao: 'escalar' })
    expect(s.purchase.findPurchase.mock.calls).toEqual([
      ['primeiro@example.test'], ['segundo@example.test'], ['terceiro@example.test'],
    ])
  })

  it('compra encontrada devolve só found e não conta como falha', async () => {
    const s = await setup()
    const found = { found: true as const, customerId: 'customer', products: ['Atlas'], lastNotice: 'Entregue' }
    s.purchase.findPurchase.mockResolvedValueOnce(found)
    expect(await s.tools.buscar_compra('compra@example.test')).toEqual({ found: true })
    expect(await s.tools.buscar_compra('ausente@example.test')).toEqual({ found: false })
  })

  it('não conta erro de consulta como compra não encontrada', async () => {
    const s = await setup()
    s.purchase.findPurchase.mockRejectedValueOnce(new Error('purchase_failed'))
    await expect(s.tools.buscar_compra('compra@example.test')).rejects.toThrow('purchase_failed')
    expect(await s.tools.buscar_compra('ausente@example.test')).toEqual({ found: false })
  })

  it.each([{ ok: true }, { ok: false, reason: 'limite_conversa' }] as const)('reenviar_acesso vincula à conversa e devolve $ok', async result => {
    const s = await setup()
    s.purchase.resendAccess.mockResolvedValueOnce(result)
    expect(await s.tools.reenviar_acesso('cliente@example.test')).toEqual(result)
    expect(s.purchase.resendAccess).toHaveBeenCalledExactlyOnceWith({ email: 'cliente@example.test', conversationId: 'conversation' })
  })

  it('aviso ao cliente na escalação sai uma vez só', async () => {
    const s = await setup()
    s.repo.knowledge = async () => [{ id: 'rule', topic: 'escalacao', rule: 'Vou conferir com a equipe 💛' }]
    await s.tools.escalar('outro', 'Dúvida do cliente')
    await s.tools.escalar('outro', 'Mais contexto')
    // Even a fresh context with the original active snapshot reads persisted state.
    await createAgentTools(s.deps).escalar('outro', 'Retomada')
    expect(s.send).toHaveBeenCalledExactlyOnceWith({ conversationId: 'conversation', accountId: 'account', text: 'Vou conferir com a equipe 💛' })
    expect([...s.messages.values()].filter(message => message.author === 'agente').map(message => message.text)).toEqual(['Vou conferir com a equipe 💛'])
    expect((await s.repo.getConversation('conversation'))?.state).toBe('escalated')
  })

  it.each([false, true])('responder e escalar no mesmo lote enviam um único aviso e notificam Allan (escalar primeiro: %s)', async escalationFirst => {
    const s = await setup()
    const blocks = [
      { type: 'tool_use' as const, id: 'reply', name: 'responder', input: { texto: 'Vou verificar com a equipe.' } },
      { type: 'tool_use' as const, id: 'escalate', name: 'escalar', input: { motivo: 'reembolso', resumo: 'Pediu reembolso.' } },
    ]
    const callModel: CallModel = async () => ({ stop_reason: 'tool_use', content: escalationFirst ? blocks.reverse() : blocks }) as Awaited<ReturnType<CallModel>>
    const result = await runAgent({ system: 'instruções', messages: [{ role: 'user', text: 'Quero reembolso' }], tools: s.tools, callModel, deadline: new Date(now.getTime() + 240000) })
    expect(result.escalated).toBe(true)
    expect(s.send).toHaveBeenCalledTimes(1)
    expect(s.io.send.mock.calls.map(([owner]) => owner)).toEqual([11, 22])
    expect((await s.repo.getConversation('conversation'))?.state).toBe('escalated')
  })

  it('usa aviso padrão quando o banco não tem o tópico escalacao', async () => {
    const s = await setup()
    expect(await s.tools.escalar('sem_solucao', 'Precisa de ajuda')).toEqual({ ok: true })
    expect(s.send).toHaveBeenCalledExactlyOnceWith({ conversationId: 'conversation', accountId: 'account', text: 'Vou verificar com a equipe e te respondo aqui 💛' })
  })

  it('não avisa novamente cliente de conversa já escalada', async () => {
    const s = await setup()
    await s.repo.setState('conversation', 'escalated')
    await createAgentTools({ ...s.deps, conversation: (await s.repo.getConversation('conversation'))! }).escalar('outro', 'Retomada')
    expect(s.send).not.toHaveBeenCalled()
  })

  it('mantém o aviso único ao repetir após falha do Telegram no mesmo contexto', async () => {
    const s = await setup()
    s.io.send.mockReset().mockRejectedValueOnce(new Error('failed')).mockRejectedValueOnce(new Error('failed')).mockResolvedValue(303)
    await expect(s.tools.escalar('outro', 'Ajuda')).rejects.toThrow('agent_escalation_failed')
    await expect(s.tools.escalar('outro', 'Ajuda')).resolves.toEqual({ ok: true })
    expect(s.send).toHaveBeenCalledTimes(1)
  })

  it('passa à escalação as últimas seis mensagens após gravar o aviso', async () => {
    const s = await setup()
    for (let i = 2; i <= 8; i++) {
      await s.repo.recordIncoming({
        id: `incoming-${i}`, conversationId: 'conversation', storeId: 'store', accountId: 'account',
        platform: 'instagram', customerName: 'Ana', text: `Mensagem ${i}`, at: new Date(now.getTime() - (9 - i) * 1000),
      })
    }
    const escalate = vi.fn<Escalate>().mockResolvedValue(undefined)
    await createAgentTools({ ...s.deps, escalate }).escalar('outro', 'Resumo')
    const input = escalate.mock.calls[0]?.[0] as { conversation: AgentConversation; reason: string; summary: string; recent: AgentMessage[] }
    expect(input).toMatchObject({ conversation: { id: 'conversation' }, reason: 'outro', summary: 'Resumo' })
    expect(input.recent).toHaveLength(6)
    expect(input.recent.at(-1)).toMatchObject({ author: 'agente', text: 'Vou verificar com a equipe e te respondo aqui 💛' })
  })
})

describe('escalação no Telegram', () => {
  it.each(['active', 'paused'] as const)('keepState preserva %s ao encaminhar ao Telegram', async state => {
    const s = await setup()
    if (state === 'paused') await s.repo.pauseConversation('conversation', new Date(now.getTime() + 3600000))
    const before = await s.repo.getConversation('conversation')
    await createEscalate(s.io, [11], s.repo)({ conversation: before!, reason: 'agente_pausado', summary: 'Ajuda', recent: [], keepState: true })
    expect(s.io.send).toHaveBeenCalledTimes(1)
    expect(await s.repo.getConversation('conversation')).toEqual(before)
  })

  it.each(['continuacao', 'pausado_pelo_app', 'excesso_conversa', 'limite_diario'])('%s avisa no máximo uma vez por conversa a cada dez minutos', async reason => {
    const s = await setup()
    const notify = createEscalate(s.io, [11], s.repo)
    const escalation = { conversation: s.conversation, reason, summary: 'Ajuda', recent: [], keepState: true }
    await notify(escalation)
    vi.setSystemTime(new Date(now.getTime() + 599999))
    expect(await notify(escalation)).toBe(false)
    expect(s.io.send).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date(now.getTime() + 600000))
    await notify(escalation)
    expect(s.io.send).toHaveBeenCalledTimes(2)
  })

  it('limite de avisos é compartilhado entre motivos e atômico para notificadores concorrentes', async () => {
    const s = await setup()
    const first = createEscalate(s.io, [11], s.repo)
    const second = createEscalate(s.io, [11], s.repo)
    const base = { conversation: s.conversation, summary: 'Ajuda', recent: [], keepState: true }
    const results = await Promise.all([first({ ...base, reason: 'continuacao' }), second({ ...base, reason: 'limite_diario' })])
    expect(results.filter(result => result === false)).toHaveLength(1)
    expect(s.io.send).toHaveBeenCalledTimes(1)
    expect((await s.repo.getConversation('conversation'))?.state).toBe('active')
  })

  it('escalar avisa só proprietários', async () => {
    const s = await setup()
    await s.tools.escalar('compra_nao_encontrada', 'Não encontrou a compra')
    expect(s.io.send.mock.calls.map(([owner]) => owner)).toEqual([11, 22])
    expect(await s.repo.findEscalationByTelegram(11, 101)).toMatchObject({ conversationId: 'conversation', state: 'open' })
    expect(await s.repo.findEscalationByTelegram(22, 202)).toMatchObject({ conversationId: 'conversation', state: 'open' })
    expect((await s.repo.getConversation('conversation'))?.state).toBe('escalated')
  })

  it('mensagem de escalação não traz e-mail do cadastro', async () => {
    const s = await setup()
    const legacyResult = { found: true, customerId: 'private-customer-id', products: ['Produto privado'], lastNotice: 'Enviado para cadastro@example.test' }
    s.purchase.findPurchase.mockResolvedValue(legacyResult)
    await s.tools.buscar_compra('digitado@example.test')
    await s.tools.escalar('outro', 'Cliente pede ajuda')
    for (const [, text] of s.io.send.mock.calls) {
      expect(text).toContain('Ana')
      expect(text).toContain('cliente: Preciso de ajuda')
      for (const secret of ['cadastro@example.test', 'digitado@example.test', 'Produto privado', 'private-customer-id', 'Enviado para']) expect(text).not.toContain(secret)
    }
  })

  it.each(['instagram', 'facebook'] as const)('formata %s, escapa dados e mostra só as seis mensagens finais', async platform => {
    const s = await setup()
    const recent: AgentMessage[] = Array.from({ length: 8 }, (_, index) => ({
      id: `m-${index}`, author: index % 2 ? 'agente' : 'cliente', direction: index % 2 ? 'out' : 'in', text: index === 7 ? '<b>Ajuda & suporte</b> cliente@example.test' : `Texto ${index}`, createdAt: now,
    }))
    await createEscalate(s.io, [11], s.repo)({ conversation: { ...s.conversation, platform, customerName: '<Ana & Bia>' }, reason: '<motivo>', summary: 'Resumo & contexto', recent })
    const text = s.io.send.mock.calls[0][1]
    expect(text).toContain(platform === 'instagram' ? 'Instagram' : 'Facebook')
    for (const expected of ['&lt;Ana &amp; Bia&gt;', '&lt;motivo&gt;', 'Resumo &amp; contexto', 'cliente: Texto 2', 'agente: &lt;b&gt;Ajuda &amp; suporte&lt;/b&gt; cliente@example.test', 'Responda a esta mensagem para enviar ao cliente.']) expect(text).toContain(expected)
    expect(text).not.toContain('Texto 0')
    expect(text).not.toContain('Texto 1')
    expect(text.indexOf('Texto 2')).toBeLessThan(text.indexOf('Texto 6'))
  })

  it('limita o HTML final a menos de 3500 caracteres sem cortar entidades', async () => {
    const s = await setup()
    const long = '<&>💛'.repeat(4000)
    await createEscalate(s.io, [11], s.repo)({
      conversation: { ...s.conversation, customerName: long }, reason: long, summary: long,
      recent: Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, author: 'cliente', direction: 'in', text: long, createdAt: now })),
    })
    const text = s.io.send.mock.calls[0][1]
    expect(text.length).toBeLessThan(3500)
    expect(text).toContain('Responda a esta mensagem para enviar ao cliente.')
    expect(text).toContain('…')
    expect(text.replace(/&(amp|lt|gt);/g, '')).not.toContain('&')
    expect(text.match(/cliente:/g)).toHaveLength(6)
  })

  it('recusa escalação sem proprietários e não muda o estado', async () => {
    const s = await setup()
    await expect(createEscalate(s.io, [], s.repo)({ conversation: s.conversation, reason: 'outro', summary: 'Ajuda', recent: [] })).rejects.toThrow('agent_no_owners')
    expect(s.io.send).not.toHaveBeenCalled()
    expect((await s.repo.getConversation('conversation'))?.state).toBe('active')
  })

  it.each([11, 22])('falha no proprietário %s não impede o outro', async failedOwner => {
    const s = await setup()
    s.io.send.mockReset().mockImplementation(async owner => {
      if (owner === failedOwner) throw new Error('telegram_request_failed')
      expect((await s.repo.getConversation('conversation'))?.state).toBe('active')
      return 303
    })
    await createEscalate(s.io, [11, 22], s.repo)({ conversation: s.conversation, reason: 'outro', summary: 'Ajuda', recent: [] })
    expect(s.io.send.mock.calls.map(([owner]) => owner)).toEqual([11, 22])
    expect(await s.repo.findEscalationByTelegram(failedOwner, 303)).toBeNull()
    expect(await s.repo.findEscalationByTelegram(failedOwner === 11 ? 22 : 11, 303)).toMatchObject({ conversationId: 'conversation' })
    expect((await s.repo.getConversation('conversation'))?.state).toBe('escalated')
  })

  it('propaga erro se todos os proprietários falharem e preserva estado', async () => {
    const s = await setup()
    s.io.send.mockReset().mockRejectedValue(new Error('telegram_request_failed'))
    await expect(createEscalate(s.io, [11, 22], s.repo)({ conversation: s.conversation, reason: 'outro', summary: 'Ajuda', recent: [] })).rejects.toThrow('agent_escalation_failed')
    expect(s.io.send).toHaveBeenCalledTimes(2)
    expect((await s.repo.getConversation('conversation'))?.state).toBe('active')
  })
})
