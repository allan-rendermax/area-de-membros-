import type { EmailKind } from '@/lib/domain/types'
import type { FailedEmail } from '@/lib/email/batch'
import type { EmailLogRepo } from '@/lib/email/notifier'
import { createAdminClient } from '@/lib/supabase/admin'

export type EmailLogStatus = 'pendente' | 'enviado' | 'falhou'
export type EmailLogFilter = 'todos' | EmailLogStatus
export const EMAIL_LOG_PAGE_SIZE = 50

export type EmailLogEntry = {
  id: string
  createdAt: string
  sentAt: string | null
  storeId: string | null
  storeName: string | null
  customerId: string | null
  toEmail: string
  kind: EmailKind
  status: EmailLogStatus
  error: string | null
  resolved: boolean
}

type DbEntry = {
  id: string
  created_at: string
  sent_at: string | null
  store_id: string | null
  customer_id: string | null
  to_email: string
  kind: EmailKind
  status: EmailLogStatus
  error: string | null
  resolved_by: string | null
  stores: { name: string } | null
}

const ENTRY_COLUMNS = 'id, created_at, sent_at, store_id, customer_id, to_email, kind, status, error, resolved_by, stores(name)'

function toEntry(row: DbEntry): EmailLogEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    storeId: row.store_id,
    storeName: row.stores?.name ?? null,
    customerId: row.customer_id,
    toEmail: row.to_email,
    kind: row.kind,
    status: row.status,
    error: row.error,
    resolved: row.resolved_by !== null,
  }
}

export function createEmailLogRepo(): EmailLogRepo {
  const db = createAdminClient()
  return {
    async start(entry) {
      const { data, error } = await db
        .from('email_log')
        .insert({
          store_id: entry.storeId,
          customer_id: entry.customerId,
          to_email: entry.toEmail,
          kind: entry.kind,
          product_ids: entry.productIds,
          status: 'pendente',
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    async finish(id, result) {
      const row =
        result.status === 'enviado'
          ? { status: 'enviado', provider_id: result.providerId, sent_at: new Date().toISOString(), error: null }
          : { status: 'falhou', error: result.error }
      const { error } = await db.from('email_log').update(row).eq('id', id)
      if (error) throw error
    },
  }
}

export async function listEmailLog(filter: EmailLogFilter, page: number): Promise<{ entries: EmailLogEntry[]; hasMore: boolean }> {
  const from = Math.max(0, page) * EMAIL_LOG_PAGE_SIZE
  let query = createAdminClient()
    .from('email_log')
    .select(ENTRY_COLUMNS)
    .order('created_at', { ascending: false })
    .range(from, from + EMAIL_LOG_PAGE_SIZE)
  if (filter !== 'todos') query = query.eq('status', filter)
  const { data, error } = await query
  if (error) throw error
  const rows = (data as unknown as DbEntry[]).map(toEntry)
  return { entries: rows.slice(0, EMAIL_LOG_PAGE_SIZE), hasMore: rows.length > EMAIL_LOG_PAGE_SIZE }
}

export async function getEmailLogEntry(id: string): Promise<EmailLogEntry | null> {
  const { data, error } = await createAdminClient().from('email_log').select(ENTRY_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toEntry(data as unknown as DbEntry) : null
}

export async function listUnresolvedFailed(): Promise<FailedEmail[]> {
  const { data, error } = await createAdminClient()
    .from('email_log')
    .select('id, store_id, customer_id, to_email, created_at')
    .eq('status', 'falhou')
    .is('resolved_by', null)
    .order('created_at')
    .limit(1000)
  if (error) throw error
  return data.map((row) => ({
    id: row.id as string,
    storeId: row.store_id as string | null,
    customerId: row.customer_id as string | null,
    toEmail: row.to_email as string,
    createdAt: row.created_at as string,
  }))
}

export async function countUnresolvedFailed(): Promise<number> {
  const { count, error } = await createAdminClient()
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'falhou')
    .is('resolved_by', null)
  if (error) throw error
  return count ?? 0
}

export async function countEmailsUsedToday(): Promise<number> {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const { count, error } = await createAdminClient()
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .in('status', ['enviado', 'pendente'])
    .gte('created_at', start.toISOString())
  if (error) throw error
  return count ?? 0
}

export async function markEmailsResolved(ids: string[], resolvedBy: string): Promise<void> {
  if (ids.length === 0) return
  const { error } = await createAdminClient().from('email_log').update({ resolved_by: resolvedBy }).in('id', ids)
  if (error) throw error
}
