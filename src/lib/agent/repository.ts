import { createAdminClient } from '@/lib/supabase/admin'
import type { AgentConversation, AgentMessage } from './types'

export interface AgentRepository {
  recordIncoming(m: { id: string; conversationId: string; storeId: string; accountId: string; platform: 'instagram' | 'facebook'; customerName: string; text: string; at: Date }): Promise<boolean>
  isOwnOutgoing(messageId: string): Promise<boolean>
  recordOutgoing(m: { id: string; conversationId: string; author: 'agente' | 'allan'; text: string }): Promise<void>
  pauseConversation(id: string, until: Date): Promise<void>
  getConversation(id: string): Promise<AgentConversation | null>
  recentMessages(id: string, limit: number): Promise<AgentMessage[]>
  setState(id: string, state: 'active' | 'escalated' | 'paused'): Promise<void>
  isEnabled(storeId: string): Promise<boolean>
  setEnabled(storeId: string, on: boolean): Promise<void>
  knowledge(storeId: string): Promise<{ id: string; topic: string; rule: string }[]>
  addKnowledge(k: { storeId: string; topic: string; rule: string; sourceEscalation: string }): Promise<string>
  deactivateKnowledge(id: string): Promise<boolean>
  createEscalation(e: { conversationId: string; reason: string; chatId: number; messageId: number }): Promise<string>
  findEscalationByTelegram(chatId: number, messageId: number): Promise<{ id: string; conversationId: string; state: 'open' | 'answered' } | null>
  answerEscalation(id: string): Promise<void>
  agentResendsToday(storeId: string): Promise<number>
  agentResendSince(conversationId: string, since: Date): Promise<boolean>
}

type ConversationRow = {
  id: string; store_id: string; account_id: string; platform: AgentConversation['platform']
  customer_name: string | null; state: AgentConversation['state']; paused_until: string | null; last_incoming_at: string | null
}
type MessageRow = {
  id: string; direction: AgentMessage['direction']; author: AgentMessage['author']; text: string; created_at: string
}

function conversation(row: ConversationRow): AgentConversation {
  return {
    id: row.id, storeId: row.store_id, accountId: row.account_id, platform: row.platform,
    customerName: row.customer_name ?? '', state: row.state,
    pausedUntil: row.paused_until ? new Date(row.paused_until) : null,
    lastIncomingAt: row.last_incoming_at ? new Date(row.last_incoming_at) : null,
  }
}
function message(row: MessageRow): AgentMessage {
  return { id: row.id, direction: row.direction, author: row.author, text: row.text, createdAt: new Date(row.created_at) }
}

export function createAgentRepository(): AgentRepository {
  const db = createAdminClient()
  return {
    async recordIncoming(m) {
      const { error: conversationError } = await db.from('agent_conversations').upsert({
        id: m.conversationId, store_id: m.storeId, account_id: m.accountId, platform: m.platform,
        customer_name: m.customerName, last_incoming_at: m.at.toISOString(),
      }, { onConflict: 'id' })
      if (conversationError) throw new Error('agent_conversation_storage_failed')
      const { error } = await db.from('agent_messages').insert({
        id: m.id, conversation_id: m.conversationId, direction: 'in', author: 'cliente', text: m.text, created_at: m.at.toISOString(),
      })
      if (error?.code === '23505') return false
      if (error) throw new Error('agent_message_storage_failed')
      return true
    },
    async isOwnOutgoing(id) {
      const { data, error } = await db.from('agent_messages').select('id').eq('id', id).eq('author', 'agente').maybeSingle()
      if (error) throw new Error('agent_message_read_failed')
      return data !== null
    },
    async recordOutgoing(m) {
      const { error } = await db.from('agent_messages').insert({ id: m.id, conversation_id: m.conversationId, direction: 'out', author: m.author, text: m.text })
      if (error && error.code !== '23505') throw new Error('agent_message_storage_failed')
    },
    async pauseConversation(id, until) {
      const { error } = await db.from('agent_conversations').update({ state: 'paused', paused_until: until.toISOString() }).eq('id', id)
      if (error) throw new Error('agent_conversation_update_failed')
    },
    async getConversation(id) {
      const { data, error } = await db.from('agent_conversations').select('id,store_id,account_id,platform,customer_name,state,paused_until,last_incoming_at').eq('id', id).maybeSingle()
      if (error) throw new Error('agent_conversation_read_failed')
      return data ? conversation(data as ConversationRow) : null
    },
    async recentMessages(id, limit) {
      if (limit <= 0) return []
      const { data, error } = await db.from('agent_messages').select('id,direction,author,text,created_at').eq('conversation_id', id).order('created_at', { ascending: false }).limit(limit)
      if (error) throw new Error('agent_messages_read_failed')
      return (data as MessageRow[]).reverse().map(message)
    },
    async setState(id, state) {
      const { error } = await db.from('agent_conversations').update({ state, ...(state !== 'paused' ? { paused_until: null } : {}) }).eq('id', id)
      if (error) throw new Error('agent_conversation_update_failed')
    },
    async isEnabled(storeId) {
      const { data, error } = await db.from('agent_settings').select('enabled').eq('store_id', storeId).maybeSingle()
      if (error) throw new Error('agent_settings_read_failed')
      return data?.enabled === true
    },
    async setEnabled(storeId, on) {
      const { error } = await db.from('agent_settings').upsert({ store_id: storeId, enabled: on, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
      if (error) throw new Error('agent_settings_storage_failed')
    },
    async knowledge(storeId) {
      const { data, error } = await db.from('agent_knowledge').select('id,topic,rule').eq('store_id', storeId).eq('active', true).order('created_at')
      if (error) throw new Error('agent_knowledge_read_failed')
      return data as { id: string; topic: string; rule: string }[]
    },
    async addKnowledge(k) {
      const { data, error } = await db.from('agent_knowledge').insert({ store_id: k.storeId, topic: k.topic, rule: k.rule, origin: 'allan', source_escalation: k.sourceEscalation }).select('id').single()
      if (error) throw new Error('agent_knowledge_storage_failed')
      return data.id as string
    },
    async deactivateKnowledge(id) {
      const { data, error } = await db.from('agent_knowledge').update({ active: false }).eq('id', id).eq('active', true).select('id').maybeSingle()
      if (error) throw new Error('agent_knowledge_update_failed')
      return data !== null
    },
    async createEscalation(e) {
      const { data, error } = await db.from('agent_escalations').insert({ conversation_id: e.conversationId, reason: e.reason, telegram_chat_id: e.chatId, telegram_message_id: e.messageId }).select('id').single()
      if (error) throw new Error('agent_escalation_storage_failed')
      return data.id as string
    },
    async findEscalationByTelegram(chatId, messageId) {
      const { data, error } = await db.from('agent_escalations').select('id,conversation_id,state').eq('telegram_chat_id', chatId).eq('telegram_message_id', messageId).maybeSingle()
      if (error) throw new Error('agent_escalation_read_failed')
      return data ? { id: data.id as string, conversationId: data.conversation_id as string, state: data.state as 'open' | 'answered' } : null
    },
    async answerEscalation(id) {
      const { error } = await db.from('agent_escalations').update({ state: 'answered', answered_at: new Date().toISOString() }).eq('id', id).eq('state', 'open')
      if (error) throw new Error('agent_escalation_update_failed')
    },
    async agentResendsToday(storeId) {
      const start = new Date(); start.setUTCHours(0, 0, 0, 0)
      const { count, error } = await db.from('telegram_support_actions').select('id', { count: 'exact', head: true })
        .eq('store_id', storeId).eq('origin', 'agente').eq('kind', 'resend').eq('state', 'done').not('log_id', 'is', null).gte('finished_at', start.toISOString())
      if (error) throw new Error('agent_resends_read_failed')
      return count ?? 0
    },
    async agentResendSince(conversationId, since) {
      const { data, error } = await db.from('telegram_support_actions').select('id')
        .eq('conversation_id', conversationId).eq('origin', 'agente').eq('kind', 'resend').eq('state', 'done').not('log_id', 'is', null).gte('finished_at', since.toISOString()).limit(1)
      if (error) throw new Error('agent_resends_read_failed')
      return (data?.length ?? 0) > 0
    },
  }
}
