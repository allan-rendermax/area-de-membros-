import { createAdminClient } from '@/lib/supabase/admin'

export async function countLoginAttemptsByIp(ip: string, sinceIso: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', sinceIso)
  if (error) throw error
  return count ?? 0
}

export async function countLoginAttemptsByEmailHash(hash: string, sinceIso: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email_hash', hash)
    .gte('created_at', sinceIso)
  if (error) throw error
  return count ?? 0
}

export async function recordLoginAttempt(entry: { ip: string; emailHash: string | null; storeId: string; email?: string }): Promise<void> {
  const { error } = await createAdminClient().rpc('record_login_attempt_atomic', {
    p_ip: entry.ip,
    p_email_hash: entry.emailHash,
    p_store_id: entry.storeId,
    p_email: entry.email ?? null,
  })
  if (error) throw error
}
