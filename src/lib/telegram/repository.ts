import { createAdminClient } from '@/lib/supabase/admin'
import type { SupportAction, SupportRepository } from './types'

type Row = {
  id: string; user_id: number; chat_id: number; customer_id: string; store_id: string
  kind: SupportAction['kind']; expected_email: string; new_email: string | null
  state: SupportAction['state']; expires_at: string; prompt_id: number | null
  log_id: string | null; result: string | null
}
function action(row: Row): SupportAction {
  return { id: row.id, userId: Number(row.user_id), chatId: Number(row.chat_id), customerId: row.customer_id, storeId: row.store_id, kind: row.kind, expectedEmail: row.expected_email, newEmail: row.new_email, state: row.state, expiresAt: row.expires_at, promptId: row.prompt_id, logId: row.log_id, result: row.result }
}
export function createSupportRepository(): SupportRepository {
  const db = createAdminClient()
  return {
    async acceptUpdate(updateId) {
      const { error } = await db.from('telegram_support_updates').insert({ update_id: updateId })
      if (error?.code === '23505') return false
      if (error) throw new Error('telegram_update_storage_failed')
      return true
    },
    async createAction(a) {
      const { data, error } = await db.from('telegram_support_actions').insert({ user_id: a.userId, chat_id: a.chatId, customer_id: a.customerId, store_id: a.storeId, expected_email: a.expectedEmail, state: a.state, kind: a.kind, expires_at: a.expiresAt }).select('*').single()
      if (error) throw new Error('telegram_action_storage_failed')
      return action(data as Row)
    },
    async getAction(id, who) {
      const { data, error } = await db.from('telegram_support_actions').select('*').eq('id', id).eq('user_id', who.userId).eq('chat_id', who.chatId).maybeSingle()
      if (error) throw new Error('telegram_action_read_failed')
      return data ? action(data as Row) : null
    },
    async transition(id, who, from, patch) {
      const values: Record<string, unknown> = {}
      if (patch.state !== undefined) values.state = patch.state
      if (patch.newEmail !== undefined) values.new_email = patch.newEmail
      if (patch.promptId !== undefined) values.prompt_id = patch.promptId
      if (patch.logId !== undefined) values.log_id = patch.logId
      if (patch.result !== undefined) values.result = patch.result
      if (patch.correctionConfirmed !== undefined) values.correction_confirmed = patch.correctionConfirmed
      if (patch.state === 'done' || patch.state === 'uncertain') values.finished_at = new Date().toISOString()
      const { data, error } = await db.from('telegram_support_actions').update(values).eq('id', id).eq('user_id', who.userId).eq('chat_id', who.chatId).in('state', from).select('*').maybeSingle()
      if (error) throw new Error('telegram_action_update_failed')
      return data ? action(data as Row) : null
    },
    async findReply(who, promptId) {
      const { data, error } = await db.from('telegram_support_actions').select('*').eq('user_id', who.userId).eq('chat_id', who.chatId).eq('prompt_id', promptId).eq('state', 'awaiting_email').gt('expires_at', new Date().toISOString()).maybeSingle()
      if (error) throw new Error('telegram_reply_read_failed')
      return data ? action(data as Row) : null
    },
    async claim(id, who) {
      const { data, error } = await db.from('telegram_support_actions').update({ state: 'processing' }).eq('id', id).eq('user_id', who.userId).eq('chat_id', who.chatId).eq('state', 'confirm').gt('expires_at', new Date().toISOString()).select('*').maybeSingle()
      if (error?.code === '23505') return null
      if (error) throw new Error('telegram_action_claim_failed')
      return data ? action(data as Row) : null
    },
  }
}
