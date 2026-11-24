import type { AgentRepository } from '@/lib/agent/repository'
import type { AgentConversation, AgentMessage } from '@/lib/agent/types'

async function unused(): Promise<never> { throw new Error('unused_repository_method') }

export function memoryRepository() {
  const conversations = new Map<string, AgentConversation>()
  const messages = new Map<string, AgentMessage & { conversationId: string }>()
  const lookupMisses = new Map<string, number>()
  const processingUntil = new Map<string, Date>()
  const escalations = new Map<string, { id: string; conversationId: string; reason: string; chatId: number; messageId: number; state: 'open' | 'answered' }>()
  const repo: AgentRepository = {
    async recordIncoming(m) {
      const current = conversations.get(m.conversationId)
      if (!current) lookupMisses.set(m.conversationId, 0)
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
    async claimProcessing(id, until, now) {
      const current = processingUntil.get(id)
      if (!conversations.has(id) || (current && current > now)) return false
      processingUntil.set(id, until)
      return true
    },
    async releaseProcessing(id, until) {
      if (processingUntil.get(id)?.getTime() === until.getTime()) processingUntil.delete(id)
    },
    async incrementLookupMiss(id) {
      if (!conversations.has(id)) throw new Error('agent_lookup_miss_update_failed')
      const total = (lookupMisses.get(id) ?? 0) + 1
      lookupMisses.set(id, total)
      return total
    },
    async recentMessages(id, limit) {
      if (limit <= 0) return []
      return [...messages.values()].filter(m => m.conversationId === id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(-limit)
    },
    async setState(id, state) {
      const current = conversations.get(id)
      if (current) conversations.set(id, { ...current, state, ...(state !== 'paused' ? { pausedUntil: null } : {}) })
    },
    isEnabled: unused, setEnabled: unused,
    async knowledge() { return [] },
    addKnowledge: unused, deactivateKnowledge: unused,
    async createEscalation(e) {
      const id = `escalation-${escalations.size + 1}`
      escalations.set(id, { ...e, id, state: 'open' })
      return id
    },
    async findEscalationByTelegram(chatId, messageId) {
      const found = [...escalations.values()].find(e => e.chatId === chatId && e.messageId === messageId)
      return found ? { id: found.id, conversationId: found.conversationId, state: found.state } : null
    },
    answerEscalation: unused,
    agentResendsToday: unused, agentResendSince: unused,
  }
  return { repo, conversations, messages }
}
