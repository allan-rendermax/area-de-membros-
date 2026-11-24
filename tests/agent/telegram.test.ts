import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleAgentTelegram } from '@/lib/agent/telegram'
import type { Learn } from '@/lib/agent/learn'
import type { SupportDeps } from '@/lib/telegram/types'
import { memoryRepository } from './memory-repository'

const now = new Date('2026-11-24T15:00:00Z')
const hour = 60 * 60 * 1000
const knowledgeId = '00000000-0000-4000-8000-000000000008'
afterEach(() => vi.restoreAllMocks())
function reply(text: string | undefined = 'O acesso é enviado para o e-mail da compra.', owner = 123) {
  return { update_id: 1, message: { message_id: 20, from: { id: owner }, chat: { id: owner, type: 'private' }, text: text as string | undefined, reply_to_message: { message_id: 10 } } }
}
function callback(data = `agk:off:${knowledgeId}`, owner = 123) {
  return { update_id: 2, callback_query: { id: 'callback', from: { id: owner }, data, message: { message_id: 30, chat: { id: owner, type: 'private' } } } }
}
async function setup(age = hour) {
  const memory = memoryRepository()
  await memory.repo.recordIncoming({ id: 'incoming', conversationId: 'conversation', storeId: 'store', accountId: 'account', platform: 'instagram', customerName: 'Cliente', text: 'Não recebi o acesso.', at: new Date(now.getTime() - age) })
  await memory.repo.pauseConversation('conversation', new Date(now.getTime() + hour))
  const escalationId = await memory.repo.createEscalation({ conversationId: 'conversation', reason: 'outro', chatId: 123, messageId: 10 })
  const io = { send: vi.fn<SupportDeps['io']['send']>().mockResolvedValue(30), edit: vi.fn<SupportDeps['io']['edit']>().mockResolvedValue(undefined), ack: vi.fn<SupportDeps['io']['ack']>().mockResolvedValue(undefined) }
  const zernio = { send: vi.fn().mockResolvedValue({ messageId: 'outgoing' }) }
  const learn = vi.fn<Learn>().mockResolvedValue({ general: false })
  const accepted = new Set<number>()
  const acceptUpdate = vi.fn(async (id: number) => {
    if (accepted.has(id)) return false
    accepted.add(id)
    return true
  })
  return { ...memory, escalationId, io, zernio, learn, acceptUpdate, deps: { owners: [123], repo: memory.repo, io, zernio, learn, acceptUpdate, storeId: 'store', now: () => now } }
}

describe('resposta do Allan', () => {
  it('resposta do Allan vai ao cliente e reativa a conversa', async () => {
    const h = await setup()
    await h.repo.incrementLookupMiss('conversation')
    await h.repo.incrementLookupMiss('conversation')
    expect(await handleAgentTelegram(reply(), h.deps)).toBe(true)
    expect(h.zernio.send).toHaveBeenCalledExactlyOnceWith({ conversationId: 'conversation', accountId: 'account', text: 'O acesso é enviado para o e-mail da compra.' })
    expect(h.messages.get('outgoing')).toMatchObject({ conversationId: 'conversation', author: 'allan', text: 'O acesso é enviado para o e-mail da compra.', direction: 'out' })
    expect(await h.repo.findEscalationByTelegram(123, 10)).toMatchObject({ state: 'answered' })
    expect(h.conversations.get('conversation')).toMatchObject({ state: 'active', pausedUntil: null })
    expect(await h.repo.incrementLookupMiss('conversation')).toBe(1)
    expect(h.learn).toHaveBeenCalledWith({ reply: 'O acesso é enviado para o e-mail da compra.', recent: expect.arrayContaining([expect.objectContaining({ id: 'incoming' })]) })
    expect(h.io.send).toHaveBeenCalledTimes(2)
    expect(h.io.send).toHaveBeenNthCalledWith(1, 123, 'Enviado.')
    expect(h.io.send).toHaveBeenNthCalledWith(2, 123, 'Não virou regra (caso pessoal).')
  })

  it('reentrega do mesmo update não reenvia ao cliente', async () => {
    const h = await setup(), update = reply()
    expect(await handleAgentTelegram(update, h.deps)).toBe(true)
    expect(await handleAgentTelegram(update, h.deps)).toBe(true)
    expect(h.zernio.send).toHaveBeenCalledTimes(1)
    expect(h.learn).toHaveBeenCalledTimes(1)
    expect(h.io.send).toHaveBeenCalledTimes(2)
    expect(h.acceptUpdate).toHaveBeenNthCalledWith(1, 1)
    expect(h.acceptUpdate).toHaveBeenNthCalledWith(2, 1)
    expect(h.acceptUpdate.mock.invocationCallOrder[0]).toBeLessThan(h.zernio.send.mock.invocationCallOrder[0])
    expect(await handleAgentTelegram({ ...reply('Complemento'), update_id: 2 }, h.deps)).toBe(true)
    expect(h.zernio.send).toHaveBeenCalledTimes(2)
    expect(h.zernio.send).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Complemento' }))
  })

  it('falha depois do envio não lança e não reenvia', async () => {
    const h = await setup(), update = reply()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(h.repo, 'recordOutgoing').mockRejectedValueOnce(new Error('dados privados do cliente'))
    await expect(handleAgentTelegram(update, h.deps)).resolves.toBe(true)
    await expect(handleAgentTelegram(update, h.deps)).resolves.toBe(true)
    expect(h.zernio.send).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledExactlyOnceWith('agent_reply_record_failed')
    expect(await h.repo.findEscalationByTelegram(123, 10)).toMatchObject({ state: 'answered' })
    expect(h.conversations.get('conversation')?.state).toBe('active')
    expect(h.learn).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['answerEscalation', 'agent_reply_answer_failed'],
    ['setState', 'agent_reply_state_failed'],
    ['resetLookupMisses', 'agent_reply_reset_lookup_failed'],
    ['recentMessages', 'agent_learn_failed'],
    ['addKnowledge', 'agent_knowledge_add_failed'],
  ] as const)('falha em %s é best-effort e não reenvia', async (step, code) => {
    const h = await setup(), update = reply()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(h.repo, step).mockRejectedValueOnce(new Error('dados privados do cliente'))
    h.learn.mockResolvedValue({ general: true, topic: 'acesso', rule: 'Confira o e-mail.' })
    await expect(handleAgentTelegram(update, h.deps)).resolves.toBe(true)
    await expect(handleAgentTelegram(update, h.deps)).resolves.toBe(true)
    expect(h.zernio.send).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledExactlyOnceWith(code)
    expect(h.io.send).toHaveBeenNthCalledWith(1, 123, 'Enviado.')
    if (step !== 'recentMessages') expect(h.learn).toHaveBeenCalledTimes(1)
  })

  it.each([1, 2])('falha na mensagem %s do Telegram não lança nem reenvia', async position => {
    const h = await setup(), update = reply()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    if (position === 2) h.io.send.mockResolvedValueOnce(30)
    h.io.send.mockRejectedValueOnce(new Error('dados privados do cliente'))
    await expect(handleAgentTelegram(update, h.deps)).resolves.toBe(true)
    await expect(handleAgentTelegram(update, h.deps)).resolves.toBe(true)
    expect(h.zernio.send).toHaveBeenCalledTimes(1)
    expect(h.learn).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledExactlyOnceWith(position === 1 ? 'agent_reply_confirmation_failed' : 'agent_learn_message_failed')
  })

  it('confirma Enviado antes do aprendizado', async () => {
    const h = await setup()
    const record = vi.spyOn(h.repo, 'recordOutgoing')
    let release!: (value: { general: false }) => void
    const learned = new Promise<{ general: false }>(resolve => { release = resolve })
    h.learn.mockReturnValueOnce(learned)
    const handling = handleAgentTelegram(reply(), h.deps)
    try {
      await vi.waitFor(() => expect(h.learn).toHaveBeenCalledTimes(1))
      expect(h.io.send).toHaveBeenCalledExactlyOnceWith(123, 'Enviado.')
      expect(h.io.send.mock.invocationCallOrder[0]).toBeGreaterThan(h.zernio.send.mock.invocationCallOrder[0])
      expect(h.io.send.mock.invocationCallOrder[0]).toBeLessThan(record.mock.invocationCallOrder[0])
      await expect(handleAgentTelegram(reply(), h.deps)).resolves.toBe(true)
      expect(h.zernio.send).toHaveBeenCalledTimes(1)
    } finally {
      release({ general: false })
      await handling
    }
    expect(h.io.send).toHaveBeenNthCalledWith(2, 123, 'Não virou regra (caso pessoal).')
  })

  it.each([24 * hour + 1, 7 * 24 * hour])('usa HUMAN_AGENT entre 24h e 7 dias (%s ms)', async age => {
    const h = await setup(age)
    await handleAgentTelegram(reply(), h.deps)
    expect(h.zernio.send).toHaveBeenCalledWith(expect.objectContaining({ humanAgent: true }))
  })

  it('até exatamente 24h envia sem HUMAN_AGENT', async () => {
    const h = await setup(24 * hour)
    await handleAgentTelegram(reply(), h.deps)
    expect(h.zernio.send.mock.calls[0][0]).not.toHaveProperty('humanAgent')
  })

  it.each([7 * 24 * hour + 1, null])('recusa depois de 7 dias ou sem última mensagem (%s)', async age => {
    const h = await setup(age ?? hour)
    if (age === null) h.conversations.get('conversation')!.lastIncomingAt = null
    expect(await handleAgentTelegram(reply(), h.deps)).toBe(true)
    expect(h.io.send).toHaveBeenCalledExactlyOnceWith(123, 'Passou de 7 dias, a Meta não deixa mais enviar por aqui.')
    expect(h.zernio.send).not.toHaveBeenCalled()
    expect(h.messages.size).toBe(1)
    expect(h.learn).not.toHaveBeenCalled()
    expect(await h.repo.findEscalationByTelegram(123, 10)).toMatchObject({ state: 'open' })
  })

  it.each(['', '   ', undefined])('pede texto para resposta vazia (%s)', async text => {
    const h = await setup()
    const update = reply(); update.message.text = text
    expect(await handleAgentTelegram(update, h.deps)).toBe(true)
    expect(h.io.send).toHaveBeenCalledExactlyOnceWith(123, 'Mande o texto da resposta.')
    expect(h.zernio.send).not.toHaveBeenCalled()
    expect(h.learn).not.toHaveBeenCalled()
    expect(h.acceptUpdate).not.toHaveBeenCalled()
  })

  it('escalação answered aceita complemento', async () => {
    const h = await setup()
    await h.repo.answerEscalation(h.escalationId)
    expect(await handleAgentTelegram(reply('Complemento'), h.deps)).toBe(true)
    expect(h.messages.get('outgoing')?.text).toBe('Complemento')
  })

  it('reply que não é escalação deixa o bot de suporte tratar', async () => {
    const h = await setup(), update = reply()
    update.message.reply_to_message.message_id = 99
    expect(await handleAgentTelegram(update, h.deps)).toBe(false)
    expect(h.zernio.send).not.toHaveBeenCalled()
    expect(h.io.send).not.toHaveBeenCalled()
    expect(h.acceptUpdate).not.toHaveBeenCalled()
  })

  it('não envia em uma conversa de outra loja', async () => {
    const h = await setup()
    h.conversations.get('conversation')!.storeId = 'other'
    expect(await handleAgentTelegram(reply(), h.deps)).toBe(false)
    expect(h.zernio.send).not.toHaveBeenCalled()
    expect(h.acceptUpdate).not.toHaveBeenCalled()
  })

  it('falha no envio não grava nada nem aprende', async () => {
    const h = await setup()
    await h.repo.incrementLookupMiss('conversation')
    h.zernio.send.mockRejectedValueOnce(new Error('dados privados'))
    expect(await handleAgentTelegram(reply(), h.deps)).toBe(true)
    expect(h.io.send).toHaveBeenCalledExactlyOnceWith(123, 'Não consegui enviar. Tente de novo em instantes.')
    expect(h.messages.size).toBe(1)
    expect(await h.repo.findEscalationByTelegram(123, 10)).toMatchObject({ state: 'open' })
    expect(h.conversations.get('conversation')?.state).toBe('paused')
    expect(await h.repo.incrementLookupMiss('conversation')).toBe(2)
    expect(h.learn).not.toHaveBeenCalled()
  })

  it('falha do aprendizado preserva o envio e a reativação', async () => {
    const h = await setup()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    h.learn.mockRejectedValueOnce(new Error('dados privados do cliente'))
    await expect(handleAgentTelegram(reply(), h.deps)).resolves.toBe(true)
    await expect(handleAgentTelegram(reply(), h.deps)).resolves.toBe(true)
    expect(h.zernio.send).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledExactlyOnceWith('agent_learn_failed')
    expect(h.messages.get('outgoing')?.author).toBe('allan')
    expect(h.conversations.get('conversation')?.state).toBe('active')
    expect(h.io.send).toHaveBeenCalledTimes(2)
    expect(h.io.send).toHaveBeenNthCalledWith(1, 123, 'Enviado.')
    expect(h.io.send).toHaveBeenNthCalledWith(2, 123, 'Não virou regra (caso pessoal).')
  })

  it('salva regra geral na loja da conversa, escapa HTML e oferece desfazer', async () => {
    const h = await setup()
    h.learn.mockResolvedValueOnce({ general: true, topic: 'acesso', rule: 'Use <Acesso> & confira o e-mail.' })
    await handleAgentTelegram(reply(), h.deps)
    const knowledge = await h.repo.knowledge('store')
    expect(knowledge).toEqual([{ id: expect.any(String), topic: 'acesso', rule: 'Use <Acesso> & confira o e-mail.' }])
    expect(await h.repo.knowledge('other')).toEqual([])
    expect(h.io.send).toHaveBeenCalledTimes(2)
    expect(h.io.send).toHaveBeenNthCalledWith(1, 123, 'Enviado.')
    expect(h.io.send).toHaveBeenNthCalledWith(2, 123, 'Aprendi: Use &lt;Acesso&gt; &amp; confira o e-mail.', [[{ text: 'Não aprender isso', callback_data: `agk:off:${knowledge[0].id}` }]])
  })
})

describe('permissões, aprendizado e comandos', () => {
  it('operador que não é dono não é tratado', async () => {
    const h = await setup()
    for (const update of [reply('Resposta', 456), callback(undefined, 456), { ...reply('/agente pausar', 456), message: { ...reply('/agente pausar', 456).message, reply_to_message: undefined } }]) {
      expect(await handleAgentTelegram(update, h.deps)).toBe(false)
    }
    expect(h.zernio.send).not.toHaveBeenCalled()
    expect(h.io.send).not.toHaveBeenCalled()
    expect(h.io.ack).not.toHaveBeenCalled()
    expect(h.acceptUpdate).not.toHaveBeenCalled()
  })

  it('não aprender isso desativa a entrada', async () => {
    const h = await setup()
    const id = await h.repo.addKnowledge({ storeId: 'store', topic: 'acesso', rule: 'Confira o e-mail.', sourceEscalation: h.escalationId })
    expect(await handleAgentTelegram(callback(`agk:off:${id}`), h.deps)).toBe(true)
    expect(await h.repo.knowledge('store')).toEqual([])
    expect(h.io.ack).toHaveBeenCalledExactlyOnceWith('callback')
    expect(h.io.edit).toHaveBeenCalledExactlyOnceWith(123, 30, 'Regra desativada.')
  })

  it('callback sem regra informa não encontrada', async () => {
    const h = await setup()
    expect(await handleAgentTelegram(callback(), h.deps)).toBe(true)
    expect(h.io.edit).toHaveBeenCalledExactlyOnceWith(123, 30, 'Regra não encontrada.')
  })

  it('reentrega do callback não desativa nem edita de novo', async () => {
    const h = await setup()
    const deactivate = vi.spyOn(h.repo, 'deactivateKnowledge')
    const id = await h.repo.addKnowledge({ storeId: 'store', topic: 'acesso', rule: 'Confira o e-mail.', sourceEscalation: h.escalationId })
    const update = callback(`agk:off:${id}`)
    expect(await handleAgentTelegram(update, h.deps)).toBe(true)
    expect(await handleAgentTelegram(update, h.deps)).toBe(true)
    expect(deactivate).toHaveBeenCalledExactlyOnceWith(id)
    expect(h.io.ack).toHaveBeenCalledTimes(1)
    expect(h.io.edit).toHaveBeenCalledExactlyOnceWith(123, 30, 'Regra desativada.')
    expect(h.acceptUpdate.mock.invocationCallOrder[0]).toBeLessThan(deactivate.mock.invocationCallOrder[0])
  })

  it.each(['agk:off:inválido', 'outro:botao'])('callback inválido volta ao suporte: %s', async data => {
    const h = await setup()
    expect(await handleAgentTelegram(callback(data), h.deps)).toBe(false)
    expect(h.io.ack).not.toHaveBeenCalled()
    expect(h.acceptUpdate).not.toHaveBeenCalled()
  })

  it('/agente pausar desliga', async () => {
    const h = await setup()
    await h.repo.setEnabled('store', true)
    await h.repo.setEnabled('other', true)
    expect(await handleAgentTelegram(reply('/agente pausar'), h.deps)).toBe(true)
    expect(await h.repo.isEnabled('store')).toBe(false)
    expect(await h.repo.isEnabled('other')).toBe(true)
    expect(h.io.send).toHaveBeenCalledExactlyOnceWith(123, 'Agente pausado. As mensagens novas vão para cá.')
  })

  it('/agente ligar liga e status reflete a configuração', async () => {
    const h = await setup()
    await handleAgentTelegram(reply('/agente status'), h.deps)
    expect(h.io.send).toHaveBeenLastCalledWith(123, 'Agente pausado.')
    await handleAgentTelegram({ ...reply('/agente ligar'), update_id: 2 }, h.deps)
    expect(await h.repo.isEnabled('store')).toBe(true)
    expect(h.io.send).toHaveBeenLastCalledWith(123, 'Agente ligado.')
    await handleAgentTelegram({ ...reply('/agente status'), update_id: 3 }, h.deps)
    expect(h.io.send).toHaveBeenLastCalledWith(123, 'Agente ligado.')
  })

  it.each(['/agente pausar', '/agente ligar', '/agente status'])('reentrega de %s não age de novo', async text => {
    const h = await setup(), update = reply(text)
    const setEnabled = vi.spyOn(h.repo, 'setEnabled')
    const isEnabled = vi.spyOn(h.repo, 'isEnabled')
    expect(await handleAgentTelegram(update, h.deps)).toBe(true)
    expect(await handleAgentTelegram(update, h.deps)).toBe(true)
    expect(h.io.send).toHaveBeenCalledTimes(1)
    const action = text === '/agente status' ? isEnabled : setEnabled
    expect(action).toHaveBeenCalledTimes(1)
    expect(h.acceptUpdate.mock.invocationCallOrder[0]).toBeLessThan(action.mock.invocationCallOrder[0])
  })

  it('mensagem comum sem reply volta ao suporte', async () => {
    const h = await setup(), update = { ...reply(), message: { ...reply().message, reply_to_message: undefined } }
    expect(await handleAgentTelegram(update, h.deps)).toBe(false)
    expect(h.io.send).not.toHaveBeenCalled()
    expect(h.acceptUpdate).not.toHaveBeenCalled()
  })
})
