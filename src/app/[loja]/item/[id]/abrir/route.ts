import { notFound, redirect } from 'next/navigation'
import { canAccessLevel } from '@/lib/access/access'
import { isUuid } from '@/lib/content/url'
import { loadGrantedProductLevels } from '@/lib/data/access'
import { resolveResourceDestination } from '@/lib/data/resource-download'
import { recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext } from '@/lib/data/products'
import { env } from '@/lib/env'
import { requireStoreSession } from '@/lib/membros/session'

export async function GET(_request: Request, { params }: { params: Promise<{ loja: string; id: string }> }) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()
  const { store, customer } = await requireStoreSession(loja)
  const [ctx, levels] = await Promise.all([
    getItemWithContext(id),
    loadGrantedProductLevels(store.id, customer),
  ])

  if (!ctx || ctx.product.storeId !== store.id || !ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished) notFound()
  const level = levels.get(ctx.product.id)
  if (!level) redirect(`/${store.slug}?comprar=${ctx.product.slug}`)
  if (!canAccessLevel(level, ctx.module.requiredLevel ?? 'basic')) redirect(`/${store.slug}/produto/${ctx.product.slug}?bloqueado=1`)

  const destination = await resolveResourceDestination(ctx.item, env.supabaseUrl)
  if (!destination) notFound()

  await recordItemAccess({ customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind })
  redirect(destination)
}
