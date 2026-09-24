'use server'

import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { isUuid, isHttpUrl } from '@/lib/content/url'
import { toVideoEmbed } from '@/lib/content/video'
import { isValidStoreSlug } from '@/lib/content/slug'
import { loadGrantedProductIds } from '@/lib/data/access'
import { setItemCompletion } from '@/lib/data/member-progress'
import { getItemWithContext } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'

export type CompletionResult = { ok: true; completed: boolean } | { ok: false; error: string }

export async function saveCompletion(storeSlug: string, itemId: string, completed: boolean): Promise<CompletionResult> {
  if (typeof storeSlug !== 'string' || !isValidStoreSlug(storeSlug) || typeof itemId !== 'string' || !isUuid(itemId) || typeof completed !== 'boolean') {
    return { ok: false, error: 'Dados inválidos. Atualize a página e tente novamente.' }
  }
  try {
    const { store, customer } = await requireStoreSession(storeSlug)
    if (store.slug !== storeSlug) return { ok: false, error: 'Esta loja não corresponde à sessão atual.' }
    const [ctx, granted] = await Promise.all([getItemWithContext(itemId), loadGrantedProductIds(store.id, customer)])
    if (!ctx || ctx.product.storeId !== store.id || !ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished || !granted.has(ctx.product.id)) {
      return { ok: false, error: 'Material indisponível para esta conta.' }
    }
    if (ctx.item.kind === 'video' ? !toVideoEmbed(ctx.item.url) : !(['arquivo', 'link'].includes(ctx.item.kind) && isHttpUrl(ctx.item.url))) {
      return { ok: false, error: 'O destino deste material está indisponível.' }
    }
    await setItemCompletion({ customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, completed })
    revalidatePath(`/${store.slug}`)
    revalidatePath(`/${store.slug}/produto/${ctx.product.slug}`)
    revalidatePath(`/${store.slug}/item/${ctx.item.id}`)
    return { ok: true, completed }
  } catch (error) {
    unstable_rethrow(error)
    return { ok: false, error: 'Não foi possível salvar o progresso. Tente novamente.' }
  }
}
