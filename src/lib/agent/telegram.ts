import type { z } from 'zod'
import type { telegramUpdateSchema } from '@/lib/telegram/handler'
import type { SupportDeps } from '@/lib/telegram/types'
import { html } from '@/lib/telegram/format'
import type { Learn } from './learn'
import type { AgentRepository } from './repository'
import type { ZernioClient } from './zernio'

type AgentTelegramDeps = {
  owners: number[]
  repo: AgentRepository
  zernio: ZernioClient
  io: SupportDeps['io']
  learn: Learn
  acceptUpdate(updateId: number): Promise<boolean>
  now(): Date
  storeId: string
}

async function bestEffort<T>(code: string, action: () => Promise<T>): Promise<T | undefined> {
  try { return await action() }
  catch { console.error(code) }
}

export async function handleAgentTelegram(update: z.infer<typeof telegramUpdateSchema>, deps: AgentTelegramDeps): Promise<boolean> {
  const { message, callback_query: callback } = update
  const sender = callback?.from ?? message?.from
  if (!sender || !deps.owners.includes(sender.id)) return false

  if (callback) {
    const match = callback.data?.match(/^agk:off:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
    if (!match || !callback.message) return false
    if (!(await deps.acceptUpdate(update.update_id))) return true
    const found = await deps.repo.deactivateKnowledge(match[1])
    await deps.io.ack(callback.id)
    await deps.io.edit(callback.message.chat.id, callback.message.message_id, found ? 'Regra desativada.' : 'Regra não encontrada.')
    return true
  }
  if (!message) return false
  const text = message.text?.trim() ?? ''
  if (['/agente pausar', '/agente ligar', '/agente status'].includes(text) && !(await deps.acceptUpdate(update.update_id))) return true
  if (text === '/agente pausar') {
    await deps.repo.setEnabled(deps.storeId, false)
    await deps.io.send(message.chat.id, 'Agente pausado. As mensagens novas vão para cá.')
    return true
  }
  if (text === '/agente ligar') {
    await deps.repo.setEnabled(deps.storeId, true)
    await deps.io.send(message.chat.id, 'Agente ligado.')
    return true
  }
  if (text === '/agente status') {
    const enabled = await deps.repo.isEnabled(deps.storeId)
    await deps.io.send(message.chat.id, enabled ? 'Agente ligado.' : 'Agente pausado.')
    return true
  }
  if (!message.reply_to_message) return false
  const escalation = await deps.repo.findEscalationByTelegram(message.chat.id, message.reply_to_message.message_id)
  if (!escalation) return false
  if (!text) {
    await deps.io.send(message.chat.id, 'Mande o texto da resposta.')
    return true
  }
  const conversation = await deps.repo.getConversation(escalation.conversationId)
  if (!conversation || conversation.storeId !== deps.storeId) return false
  if (!(await deps.acceptUpdate(update.update_id))) return true
  const age = conversation.lastIncomingAt ? deps.now().getTime() - conversation.lastIncomingAt.getTime() : Infinity
  if (age > 7 * 24 * 60 * 60 * 1000) {
    await deps.io.send(message.chat.id, 'Passou de 7 dias, a Meta não deixa mais enviar por aqui.')
    return true
  }
  let messageId: string
  try {
    const sent = await deps.zernio.send({
      conversationId: conversation.id, accountId: conversation.accountId, text,
      ...(age > 24 * 60 * 60 * 1000 ? { humanAgent: true } : {}),
    })
    messageId = sent.messageId
  } catch {
    await deps.io.send(message.chat.id, 'Não consegui enviar. Tente de novo em instantes.')
    return true
  }
  // O envio já aconteceu: nenhuma falha posterior deve provocar uma reentrega.
  await bestEffort('agent_reply_confirmation_failed', () => deps.io.send(message.chat.id, 'Enviado.'))
  await bestEffort('agent_reply_record_failed', () => deps.repo.recordOutgoing({ id: messageId, conversationId: conversation.id, author: 'allan', text }))
  await bestEffort('agent_reply_answer_failed', () => deps.repo.answerEscalation(escalation.id))
  await bestEffort('agent_reply_state_failed', () => deps.repo.setState(conversation.id, 'active'))
  await bestEffort('agent_reply_reset_lookup_failed', () => deps.repo.resetLookupMisses(conversation.id))
  const learned = await bestEffort('agent_learn_failed', async () => deps.learn({ reply: text, recent: await deps.repo.recentMessages(conversation.id, 20) }))
  if (learned?.general) {
    const id = await bestEffort('agent_knowledge_add_failed', () => deps.repo.addKnowledge({ storeId: conversation.storeId, topic: learned.topic, rule: learned.rule, sourceEscalation: escalation.id }))
    if (id) await bestEffort('agent_learn_message_failed', () => deps.io.send(message.chat.id, `Aprendi: ${html(learned.rule, 4000)}`, [[{ text: 'Não aprender isso', callback_data: `agk:off:${id}` }]]))
  } else {
    await bestEffort('agent_learn_message_failed', () => deps.io.send(message.chat.id, 'Não virou regra (caso pessoal).'))
  }
  return true
}
