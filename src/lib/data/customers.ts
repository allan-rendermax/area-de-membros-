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
