import { notFound, redirect } from 'next/navigation'
import { getResourceDestination } from '@/lib/content/resource'
import { isUuid } from '@/lib/content/url'
import { loadGrantedProductIds } from '@/lib/data/access'
import { recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext } from '@/lib/data/products'
import { env } from '@/lib/env'
import { requireStoreSession } from '@/lib/membros/session'

export async function GET(_request: Request, { params }: { params: Promise<{ loja: string; id: string }> }) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()
  const { store, customer } = await requireStoreSession(loja)
  const [ctx, granted] = await Promise.all([
    getItemWithContext(id),
    loadGrantedProductIds(store.id, customer),
  ])

  if (!ctx || ctx.product.storeId !== store.id || !ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished) notFound()
  if (!granted.has(ctx.product.id)) redirect(`/${store.slug}?comprar=${ctx.product.slug}`)

  const destination = getResourceDestination(ctx.item, env.supabaseUrl)
  if (!destination) notFound()

  await recordItemAccess({ customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind })
  redirect(destination)
}
