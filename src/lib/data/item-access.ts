import type { ItemKind } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

export async function recordItemAccess(entry: {
  customerId: string
  storeId: string
  productId: string
  itemId: string
  kind: ItemKind
}): Promise<void> {
  const { error } = await createAdminClient().from('item_access').insert({
    customer_id: entry.customerId,
    store_id: entry.storeId,
    product_id: entry.productId,
    item_id: entry.itemId,
    kind: entry.kind,
  })
  if (error) throw error
}

export async function listRecentProductIds(customerId: string, storeId: string, days = 30): Promise<string[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await createAdminClient()
    .from('item_access')
    .select('product_id')
    .eq('customer_id', customerId)
    .eq('store_id', storeId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return [...new Set(data.map((row) => row.product_id as string))]
}
