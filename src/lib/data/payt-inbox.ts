import { createAdminClient } from '@/lib/supabase/admin'
import type { InboxRepo } from '@/lib/orders/payt-inbox'

export function createPaytInboxRepo(): InboxRepo {
  const db = createAdminClient()
  return {
    async enqueue(key, transactionId, payload) {
      const { data, error } = await db.rpc('enqueue_payt_postback', { p_key: key, p_transaction: transactionId, p_payload: payload })
      if (error) throw error
      return data as string
    },
    async claim() {
      const { data, error } = await db.rpc('claim_payt_postback').maybeSingle()
      if (error) throw error
      const row = data as { id: string; event_id: string; payload: unknown; lease_token: string } | null
      return row ? { id: row.id, eventId: row.event_id, payload: row.payload, leaseToken: row.lease_token } : null
    },
    async complete(job) {
      const { error } = await db.from('payt_inbox').update({ state: 'done', lease_until: null, last_error: null })
        .eq('id', job.id).eq('lease_token', job.leaseToken).eq('state', 'processing')
      if (error) throw error
    },
    async fail(job, message) {
      const { error } = await db.from('payt_inbox').update({ state: 'pending', lease_until: null,
        available_at: new Date(Date.now() + 60_000).toISOString(), last_error: message.slice(0, 1000) })
        .eq('id', job.id).eq('lease_token', job.leaseToken).eq('state', 'processing')
      if (error) throw error
    },
  }
}
