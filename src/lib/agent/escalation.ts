import { createTelegramClient } from '@/lib/telegram/client'
import { getTelegramConfig } from '@/lib/telegram/config'
import { html } from '@/lib/telegram/format'
import { teamOwners } from '@/lib/telegram/team-access'
import type { SupportDeps } from '@/lib/telegram/types'
import { createAgentRepository, type AgentRepository } from './repository'
import type { AgentConversation, AgentMessage } from './types'

export type Escalate = (input: {
  conversation: AgentConversation
  reason: string
  summary: string
  recent: AgentMessage[]
}) => Promise<void>

export function createEscalate(
  io: Pick<SupportDeps['io'], 'send'>,
  owners: number[],
  repo: Pick<AgentRepository, 'createEscalation' | 'setState'>,
): Escalate {
  return async ({ conversation, reason, summary, recent }) => {
    if (!owners.length) throw new Error('agent_no_owners')
    // Escaped budgets total 3160; labels/tags keep the final HTML below 3500.
    const text = [
      '<b>Atendimento no direct</b>',
      `Plataforma: ${html(conversation.platform === 'instagram' ? 'Instagram' : 'Facebook', 20)}`,
      `Cliente: ${html(conversation.customerName, 160)}`,
      `Motivo: ${html(reason, 240)}`,
      `Resumo: ${html(summary, 700)}`,
      '',
      '<b>Últimas mensagens</b>',
      ...recent.slice(-6).map(message => html(`${message.author}: ${message.text}`, 340)),
      '',
      'Responda a esta mensagem para enviar ao cliente.',
    ].join('\n')

    let delivered = 0
    for (const owner of owners) {
      try {
        const messageId = await io.send(owner, text)
        await repo.createEscalation({ conversationId: conversation.id, reason, chatId: owner, messageId })
        delivered++
      } catch {
        // Try every owner; never log provider errors containing customer data.
      }
    }
    if (!delivered) throw new Error('agent_escalation_failed')
    await repo.setState(conversation.id, 'escalated')
  }
}

export function createRealEscalate(): Escalate {
  const config = getTelegramConfig()
  if (!config) throw new Error('telegram_config_missing')
  return createEscalate(createTelegramClient(config.token), teamOwners(), createAgentRepository())
}
