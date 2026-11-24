import type { AgentRepository } from '@/lib/agent/repository'
import type { AgentConversation, AgentMessage } from '@/lib/agent/types'

async function unused(): Promise<never> { throw new Error('unused_repository_method') }

export function memoryRepository() {
  const conversations = new Map<string, AgentConversation>()
  const messages = new Map<string, AgentMessage & { conversationId: string }>()
  const repo: AgentRepository = {
    async recordIncoming(m) {
      const current = conversations.get(m.conversationId)
      conversations.set(m.conversationId, {
        id: m.conversationId, storeId: m.storeId, accountId: m.accountId, platform: m.platform,
        customerName: m.customerName, lastIncomingAt: m.at,
        state: current?.state ?? 'active', pausedUntil: current?.pausedUntil ?? null,
      })
      if (messages.has(m.id)) return false
      messages.set(m.id, { id: m.id, conversationId: m.conversationId, direction: 'in', author: 'cliente', text: m.text, createdAt: m.at })
      return true
    },
    async isOwnOutgoing(id) { return messages.get(id)?.author === 'agente' },
    async recordOutgoing(m) {
      if (!messages.has(m.id)) messages.set(m.id, { ...m, direction: 'out', createdAt: new Date() })
    },
    async pauseConversation(id, until) {
      const current = conversations.get(id)
      if (current) conversations.set(id, { ...current, state: 'paused', pausedUntil: until })
    },
    async getConversation(id) { return conversations.get(id) ?? null },
    recentMessages: unused, setState: unused, isEnabled: unused, setEnabled: unused,
    knowledge: unused, addKnowledge: unused, deactivateKnowledge: unused,
    createEscalation: unused, findEscalationByTelegram: unused, answerEscalation: unused,
    agentResendsToday: unused, agentResendSince: unused,
  }
  return { repo, conversations, messages }
}
