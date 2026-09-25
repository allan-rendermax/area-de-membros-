'use server'

import { after } from 'next/server'
import { isUuid } from '@/lib/content/url'
import { isValidStoreSlug } from '@/lib/content/slug'
import { toVideoEmbed } from '@/lib/content/video'
import { canAccessProductModule } from '@/lib/access/product-content'
import { loadGrantedProductLevels } from '@/lib/data/access'
import { getItemWithContext } from '@/lib/data/products'
import { recordItemAccessSafely } from '@/lib/data/item-access'
import { requireStoreSession } from '@/lib/membros/session'

export async function recordVisit(storeSlug: string, itemId: string): Promise<{ ok: boolean }> {
  if (typeof storeSlug !== 'string' || !isValidStoreSlug(storeSlug) || typeof itemId !== 'string' || !isUuid(itemId)) return { ok: false }
  try {
    const { store, customer } = await requireStoreSession(storeSlug)
    if (store.slug !== storeSlug) return { ok: false }
    const [ctx, levels] = await Promise.all([getItemWithContext(itemId), loadGrantedProductLevels(store.id, customer)])
    if (!ctx || ctx.product.storeId !== store.id || !ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished ||
      !canAccessProductModule(levels.get(ctx.product.id), ctx.module.requiredLevel, ctx.product.contentMode) ||
      ctx.item.kind !== 'video' || !toVideoEmbed(ctx.item.url)) return { ok: false }

    const entry = { customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind }
    after(() => recordItemAccessSafely(entry))
    return { ok: true }
  } catch {
    // A background visit must neither disrupt playback nor navigate the page
    // when the session expired or authorization could not be revalidated.
    return { ok: false }
  }
}
