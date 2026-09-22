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

export async function createCustomer(
  email: string,
  name: string,
): Promise<{ customer: CustomerRow; created: boolean }> {
  const db = createAdminClient()

  let userId: string
  const authUser = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } })
  if (authUser.error) {
    const { data: existingId, error: rpcError } = await db.rpc('get_auth_user_id_by_email', { p_email: email })
    if (rpcError || !existingId) throw authUser.error
    userId = existingId as string
  } else {
    userId = authUser.data.user.id
  }

  // A linha em customers é o que decide "cliente novo": só um aviso consegue inseri-la,
  // mesmo com dois avisos simultâneos para o mesmo email.
  const { data: inserted, error: upsertError } = await db
    .from('customers')
    .upsert({ id: userId, email, name }, { onConflict: 'id', ignoreDuplicates: true })
    .select('id')
  if (upsertError) throw upsertError

  const { data, error } = await db.from('customers').select('id, email, name, blocked_at').eq('id', userId).single()
  if (error) throw error
  return { customer: toCustomer(data), created: inserted.length > 0 }
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

export const SHARING_DEVICE_THRESHOLD = 4
const DEVICE_WINDOW_DAYS = 30

export type CustomerSummary = CustomerRow & { recentDevices: number }

export async function searchCustomers(query: string): Promise<CustomerSummary[]> {
  const db = createAdminClient()
  let request = db.from('customers').select('id, email, name, blocked_at').order('created_at', { ascending: false }).limit(50)
  if (query) request = request.ilike('email', `%${query.replace(/[%_]/g, '')}%`)
  const { data, error } = await request
  if (error) throw error
  const customers = (data as DbCustomer[]).map(toCustomer)
  if (customers.length === 0) return []

  const since = new Date(Date.now() - DEVICE_WINDOW_DAYS * 86_400_000).toISOString()
  const { data: devices, error: devicesError } = await db
    .from('customer_devices')
    .select('customer_id')
    .in('customer_id', customers.map((c) => c.id))
    .gte('last_seen_at', since)
  if (devicesError) throw devicesError

  const counts = new Map<string, number>()
  for (const d of devices) counts.set(d.customer_id, (counts.get(d.customer_id) ?? 0) + 1)
  return customers.map((c) => ({ ...c, recentDevices: counts.get(c.id) ?? 0 }))
}

export async function getCustomer(id: string): Promise<CustomerRow | null> {
  const { data, error } = await createAdminClient().from('customers').select('id, email, name, blocked_at').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toCustomer(data) : null
}

export async function listDevices(customerId: string) {
  const { data, error } = await createAdminClient()
    .from('customer_devices')
    .select('user_agent, first_seen_at, last_seen_at')
    .eq('customer_id', customerId)
    .order('last_seen_at', { ascending: false })
  if (error) throw error
  return data.map((d) => ({ userAgent: d.user_agent, firstSeenAt: d.first_seen_at, lastSeenAt: d.last_seen_at }))
}

export async function setCustomerBlocked(id: string, blocked: boolean): Promise<void> {
  const { error } = await createAdminClient()
    .from('customers')
    .update({ blocked_at: blocked ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function changeCustomerEmail(id: string, newEmail: string): Promise<void> {
  const db = createAdminClient()
  const current = await getCustomer(id)
  if (!current) throw new Error('Cliente não encontrado')
  if (current.email === newEmail) return
  if (await findCustomerByEmail(newEmail)) throw new Error('Já existe um cliente com este email')

  const { error: authError } = await db.auth.admin.updateUserById(id, { email: newEmail, email_confirm: true })
  if (authError) throw authError

  let rpcFailure: unknown
  let definitelyRejected = false
  try {
    const { error } = await db.rpc('change_customer_email_atomic', {
      p_id: id,
      p_expected_email: current.email,
      p_new_email: newEmail,
    })
    if (error) {
      rpcFailure = error
      // SQLSTATE means PostgreSQL rejected the statement. PGRST202 means the
      // function was not found, so no statement ran. Other PostgREST/transport
      // errors can arrive while the server is still committing the request.
      definitelyRejected = error.code === 'PGRST202' || /^[0-9A-Z]{5}$/.test(error.code ?? '')
    }
  } catch (error) {
    rpcFailure = error
  }
  if (!rpcFailure) return

  // A resposta pode ter se perdido depois do commit. Só reverta Auth após ler
  // o estado autoritativo da tabela pública; nunca desfaça um commit confirmado.
  let persisted: CustomerRow | null
  try {
    persisted = await getCustomer(id)
  } catch {
    throw new Error('Falha ao confirmar a correção de email; é necessária reconciliação manual antes de tentar novamente.')
  }
  if (persisted?.email === newEmail) return
  if (persisted?.email !== current.email) {
    throw new Error('O email mudou durante a correção; é necessária reconciliação manual antes de tentar novamente.')
  }
  if (!definitelyRejected) {
    throw new Error('O resultado da correção de email é incerto; é necessária reconciliação manual antes de tentar novamente.')
  }

  try {
    const { error } = await db.auth.admin.updateUserById(id, { email: current.email, email_confirm: true })
    if (error) throw error
  } catch {
    throw new Error('Falha ao reverter o email no Auth; é necessária reconciliação manual antes de tentar novamente.')
  }
  const reason = rpcFailure instanceof Error ? rpcFailure.message : String((rpcFailure as { message?: string }).message ?? rpcFailure)
  throw new Error(`A correção de email não foi salva: ${reason}`)
}
