import type { ItemKind } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { isHttpUrl } from '@/lib/content/url'
import { toVideoEmbed } from '@/lib/content/video'

export type RecentMaterial = { itemId: string; title: string; kind: ItemKind; productId: string; productTitle: string; productSlug: string }

type RecentRow = {
  items: {
    id: string; title: string; kind: ItemKind; url: string; is_published: boolean
    modules: { is_published: boolean; products: { id: string; title: string; slug: string; store_id: string; is_published: boolean } | null } | null
  } | null
}

export async function listRecentMaterials(customerId: string, storeId: string, granted: Set<string>, productId?: string): Promise<RecentMaterial[]> {
  if (granted.size === 0) return []
  let query = createAdminClient()
    .from('item_access')
    .select('item_id, items!inner(id, title, kind, url, is_published, modules!inner(is_published, products!inner(id, title, slug, store_id, is_published)))')
    .eq('customer_id', customerId)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (productId) query = query.eq('product_id', productId)
  const { data, error } = await query
  if (error) throw error
  const result: RecentMaterial[] = []
  const seen = new Set<string>()
  for (const row of (data ?? []) as unknown as RecentRow[]) {
    const item = row.items
    const product = item?.modules?.products
    if (!item || !product || seen.has(item.id) || !granted.has(product.id) || product.store_id !== storeId || (productId && product.id !== productId)) continue
    if (!item.is_published || !item.modules?.is_published || !product.is_published) continue
    if (item.kind === 'video' ? !toVideoEmbed(item.url) : !(['arquivo', 'link'].includes(item.kind) && isHttpUrl(item.url))) continue
    seen.add(item.id)
    result.push({ itemId: item.id, title: item.title, kind: item.kind, productId: product.id, productTitle: product.title, productSlug: product.slug })
  }
  return result
}

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
