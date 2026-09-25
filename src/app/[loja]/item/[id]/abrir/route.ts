import { notFound, redirect } from 'next/navigation'
import { canAccessProductModule } from '@/lib/access/product-content'
import { isUuid } from '@/lib/content/url'
import { loadGrantedProductLevels } from '@/lib/data/access'
import { resolveResourceDestination } from '@/lib/data/resource-download'
import { recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext } from '@/lib/data/products'
import { env } from '@/lib/env'
import { requireStoreSession } from '@/lib/membros/session'
import { requireStorePreview } from '@/lib/membros/preview'

export async function GET(request: Request, { params }: { params: Promise<{ loja: string; id: string }> }) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()
  const preview = new URL(request.url).searchParams.get('previa') === '1'
  const { store, customer } = await (preview ? requireStorePreview(loja) : requireStoreSession(loja))
  const [ctx, levels] = await Promise.all([
    getItemWithContext(id),
    customer ? loadGrantedProductLevels(store.id, customer) : Promise.resolve(null),
  ])

  if (!ctx || ctx.product.storeId !== store.id || (!preview && (!ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished))) notFound()
  const level = preview ? 'complete' : levels?.get(ctx.product.id)
  if (!level) redirect(`/${store.slug}?comprar=${ctx.product.slug}`)
  if (!canAccessProductModule(level, ctx.module.requiredLevel, ctx.product.contentMode, preview)) redirect(`/${store.slug}/produto/${ctx.product.slug}?bloqueado=1`)

  const destination = await resolveResourceDestination(ctx.item, env.supabaseUrl)
  if (!destination) notFound()

  if (customer) await recordItemAccess({ customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind })
  redirect(destination)
}
