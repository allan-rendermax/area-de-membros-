import { createAdminClient } from '@/lib/supabase/admin'

export async function listCompletedItemIds(customerId: string, storeId: string, productId: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from('member_progress')
    .select('item_id')
    .eq('customer_id', customerId)
    .eq('store_id', storeId)
    .eq('product_id', productId)
  if (error) throw error
  return (data ?? []).map((row) => row.item_id as string)
}

export async function setItemCompletion(entry: { customerId: string; storeId: string; productId: string; itemId: string; completed: boolean }): Promise<void> {
  const db = createAdminClient().from('member_progress')
  const { error } = entry.completed
    ? await db.upsert({ customer_id: entry.customerId, store_id: entry.storeId, product_id: entry.productId, item_id: entry.itemId, updated_at: new Date().toISOString() }, { onConflict: 'customer_id,store_id,item_id' })
    : await db.delete().eq('customer_id', entry.customerId).eq('store_id', entry.storeId).eq('item_id', entry.itemId)
  if (error) throw error
}
