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
  now(): Date
  storeId: string
}

export async function handleAgentTelegram(update: z.infer<typeof telegramUpdateSchema>, deps: AgentTelegramDeps): Promise<boolean> {
  const { message, callback_query: callback } = update
  const sender = callback?.from ?? message?.from
  if (!sender || !deps.owners.includes(sender.id)) return false

  if (callback) {
    const match = callback.data?.match(/^agk:off:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
    if (!match || !callback.message) return false
    const found = await deps.repo.deactivateKnowledge(match[1])
    await deps.io.ack(callback.id)
    await deps.io.edit(callback.message.chat.id, callback.message.message_id, found ? 'Regra desativada.' : 'Regra não encontrada.')
    return true
  }
  if (!message) return false
  const text = message.text?.trim() ?? ''
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
  await deps.repo.recordOutgoing({ id: messageId, conversationId: conversation.id, author: 'allan', text })
  await deps.repo.answerEscalation(escalation.id)
  await deps.repo.setState(conversation.id, 'active')
  await deps.repo.resetLookupMisses(conversation.id)
  let learned: Awaited<ReturnType<Learn>> = { general: false }
  try { learned = await deps.learn({ reply: text, recent: await deps.repo.recentMessages(conversation.id, 20) }) }
  catch { /* O envio já aconteceu; falhas de aprendizado não o desfazem. */ }
  if (learned.general) {
    const id = await deps.repo.addKnowledge({ storeId: conversation.storeId, topic: learned.topic, rule: learned.rule, sourceEscalation: escalation.id })
    await deps.io.send(message.chat.id, `Enviado. Aprendi: ${html(learned.rule, 4000)}`, [[{ text: 'Não aprender isso', callback_data: `agk:off:${id}` }]])
  } else {
    await deps.io.send(message.chat.id, 'Enviado. Não virou regra (caso pessoal).')
  }
  return true
}
