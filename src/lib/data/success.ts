import type { SuccessRow } from '@/lib/success/classify'
import { createAdminClient } from '@/lib/supabase/admin'

type DbSuccessRow = {
  customer_id: string
  email: string
  first_paid_at: string
  paid_orders: number
  last_seen_at: string | null
  item_opens: number
  last_item_open_at: string | null
}

export async function loadSuccessRows(storeId: string): Promise<SuccessRow[]> {
  const client = createAdminClient()
  const rows: DbSuccessRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.rpc('store_customer_success', { p_store_id: storeId })
      .range(from, from + 999)
    if (error) throw error
    const batch = data as DbSuccessRow[]
    rows.push(...batch)
    if (batch.length < 1000) break
  }
  return rows.map((r) => ({
    customerId: r.customer_id,
    email: r.email,
    firstPaidAt: r.first_paid_at,
    paidOrders: r.paid_orders,
    lastSeenAt: r.last_seen_at,
    itemOpens: r.item_opens,
    lastItemOpenAt: r.last_item_open_at,
  }))
}

export async function countFailedEmailsSince(storeId: string, sinceIso: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('status', 'falhou')
    .is('resolved_by', null)
    .gte('created_at', sinceIso)
  if (error) throw error
  return count ?? 0
}

export async function listEmailsForCustomer(
  customerId: string,
): Promise<{ createdAt: string; kind: string; status: string; error: string | null }[]> {
  const { data, error } = await createAdminClient()
    .from('email_log')
    .select('created_at, kind, status, error')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data.map((r) => ({ createdAt: r.created_at as string, kind: r.kind as string, status: r.status as string, error: r.error as string | null }))
}

export async function listItemOpensForCustomer(
  customerId: string,
): Promise<{ createdAt: string; itemTitle: string; productTitle: string }[]> {
  const { data, error } = await createAdminClient()
    .from('item_access')
    .select('created_at, items(title), products(title)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  type Row = { created_at: string; items: { title: string } | null; products: { title: string } | null }
  return (data as unknown as Row[]).map((r) => ({
    createdAt: r.created_at,
    itemTitle: r.items?.title ?? 'Item removido',
    productTitle: r.products?.title ?? '',
  }))
}
