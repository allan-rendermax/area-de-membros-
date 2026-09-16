import { createHash } from 'node:crypto'
import type { CustomerRow } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

type DbCustomer = { id: string; email: string; name: string; blocked_at: string | null }

export function toCustomer(row: DbCustomer): CustomerRow {
  return { id: row.id, email: row.email, name: row.name, blockedAt: row.blocked_at }
}

export async function findCustomerByEmail(email: string): Promise<CustomerRow | null> {
  const { data, error } = await createAdminClient()
    .from('customers')
    .select('id, email, name, blocked_at')
    .eq('email', email)
    .maybeSingle()
  if (error) throw error
  return data ? toCustomer(data) : null
}

export async function createCustomer(email: string, name: string): Promise<CustomerRow> {
  const db = createAdminClient()

  let userId: string
  const created = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } })
  if (created.error) {
    const { data: existingId, error: rpcError } = await db.rpc('get_auth_user_id_by_email', { p_email: email })
    if (rpcError || !existingId) throw created.error
    userId = existingId as string
  } else {
    userId = created.data.user.id
  }

  const { error: upsertError } = await db
    .from('customers')
    .upsert({ id: userId, email, name }, { onConflict: 'id', ignoreDuplicates: true })
  if (upsertError) throw upsertError

  const { data, error } = await db.from('customers').select('id, email, name, blocked_at').eq('id', userId).single()
  if (error) throw error
  return toCustomer(data)
}

const LOGIN_WINDOW_MINUTES = 15

export async function countRecentLoginAttempts(ip: string): Promise<number> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString()
  const { count, error } = await createAdminClient()
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', since)
  if (error) throw error
  return count ?? 0
}

export async function recordLoginAttempt(ip: string): Promise<void> {
  const { error } = await createAdminClient().from('login_attempts').insert({ ip })
  if (error) throw error
}

export async function recordDevice(customerId: string, userAgent: string, ip: string): Promise<void> {
  const deviceHash = createHash('sha256').update(`${userAgent}|${ip}`).digest('hex')
  const { error } = await createAdminClient()
    .from('customer_devices')
    .upsert(
      { customer_id: customerId, device_hash: deviceHash, user_agent: userAgent, last_seen_at: new Date().toISOString() },
      { onConflict: 'customer_id,device_hash' },
    )
  if (error) throw error
}
