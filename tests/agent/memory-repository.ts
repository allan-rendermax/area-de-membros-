import { randomUUID } from 'node:crypto'
import type { AgentRepository } from '@/lib/agent/repository'
import type { AgentConversation, AgentMessage } from '@/lib/agent/types'

async function unused(): Promise<never> { throw new Error('unused_repository_method') }

export function memoryRepository() {
  const conversations = new Map<string, AgentConversation>()
  const messages = new Map<string, AgentMessage & { conversationId: string }>()
  const lookupMisses = new Map<string, number>()
  const processingUntil = new Map<string, Date>()
  const lastNoticeAt = new Map<string, Date>()
  const runs: { storeId: string; conversationId: string; createdAt: Date }[] = []
  const settings = new Map<string, boolean>()
  const knowledge = new Map<string, { id: string; storeId: string; topic: string; rule: string; sourceEscalation: string; active: boolean }>()
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
    async isOwnOutgoing(id, match) {
      const message = messages.get(id)
      if (message?.direction === 'out' && (message.author === 'agente' || message.author === 'allan')) return true
      return !!match && [...messages.values()].some(m => m.conversationId === match.conversationId && m.direction === 'out'
        && (m.author === 'agente' || m.author === 'allan') && m.createdAt >= match.since && m.text.trim() === match.text.trim())
    },
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
    async reserveRun(storeId, conversationId, now) {
      if (conversations.get(conversationId)?.storeId !== storeId) throw new Error('agent_run_storage_failed')
      if (runs.filter(run => run.conversationId === conversationId && run.createdAt.getTime() >= now.getTime() - 3600000 && run.createdAt <= now).length >= 10) return 'excesso_conversa'
      const day = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(at)
      if (runs.filter(run => run.storeId === storeId && day(run.createdAt) === day(now)).length >= 400) return 'limite_diario'
      runs.push({ storeId, conversationId, createdAt: now })
      return 'ok'
    },
    async claimNotice(id, now) {
      if (!conversations.has(id)) return false
      const previous = lastNoticeAt.get(id)
      if (previous && now.getTime() - previous.getTime() < 600000) return false
      lastNoticeAt.set(id, now)
      return true
    },
    async incrementLookupMiss(id) {
      if (!conversations.has(id)) throw new Error('agent_lookup_miss_update_failed')
      const total = (lookupMisses.get(id) ?? 0) + 1
      lookupMisses.set(id, total)
      return total
    },
    async resetLookupMisses(id) {
      if (conversations.has(id)) lookupMisses.set(id, 0)
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
    async isEnabled(storeId) { return settings.get(storeId) === true },
    async setEnabled(storeId, on) { settings.set(storeId, on) },
    async knowledge(storeId) { return [...knowledge.values()].filter(k => k.storeId === storeId && k.active).map(({ id, topic, rule }) => ({ id, topic, rule })) },
    async addKnowledge(k) {
      const id = randomUUID()
      knowledge.set(id, { ...k, id, active: true })
      return id
    },
    async deactivateKnowledge(id) {
      const current = knowledge.get(id)
      if (!current?.active) return false
      current.active = false
      return true
    },
    async createEscalation(e) {
      const id = `escalation-${escalations.size + 1}`
      escalations.set(id, { ...e, id, state: 'open' })
      return id
    },
    async findEscalationByTelegram(chatId, messageId) {
      const found = [...escalations.values()].find(e => e.chatId === chatId && e.messageId === messageId)
      return found ? { id: found.id, conversationId: found.conversationId, state: found.state } : null
    },
    async answerEscalation(id) {
      const current = escalations.get(id)
      if (current?.state === 'open') current.state = 'answered'
    },
    agentResendsToday: unused, agentResendSince: unused, weeklyDigest: unused,
  }
  return { repo, conversations, messages, runs }
}
