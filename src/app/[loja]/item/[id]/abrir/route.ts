import { previewContext, previewIncludesDrafts, previewAccessLevel } from '@/lib/membros/preview-context'
import { withPreview } from '@/lib/membros/paths'
import { after } from 'next/server'
import { notFound, redirect } from 'next/navigation'
import { canAccessProductModule } from '@/lib/access/product-content'
import { isUuid } from '@/lib/content/url'
import { loadGrantedProductLevels } from '@/lib/data/access'
import { resolveResourceDestination } from '@/lib/data/resource-download'
import { recordItemAccessSafely } from '@/lib/data/item-access'
import { getItemWithContext } from '@/lib/data/products'
import { env } from '@/lib/env'
import { requireStoreSession } from '@/lib/membros/session'
import { requireStorePreview } from '@/lib/membros/preview'

export async function GET(request: Request, { params }: { params: Promise<{ loja: string; id: string }> }) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()
  const query = new URL(request.url).searchParams
  const preview = previewContext({ previa: query.get('previa') ?? undefined, simular: query.get('simular') ?? undefined })
  const editorial = previewIncludesDrafts(preview)
  const { store, customer } = await (preview ? requireStorePreview(loja) : requireStoreSession(loja))
  const [ctx, levels] = await Promise.all([
    getItemWithContext(id),
    customer ? loadGrantedProductLevels(store.id, customer) : Promise.resolve(null),
  ])

  if (!ctx || ctx.product.storeId !== store.id || (!editorial && (!ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished))) notFound()
  const level = preview ? previewAccessLevel(preview) : levels?.get(ctx.product.id)
  if (!level) redirect(withPreview(`/${store.slug}?comprar=${ctx.product.slug}`, preview))
  if (!canAccessProductModule(level, ctx.module.requiredLevel, ctx.product.contentMode, editorial)) redirect(withPreview(`/${store.slug}/produto/${ctx.product.slug}?bloqueado=1`, preview))

  const destination = await resolveResourceDestination(ctx.item, env.supabaseUrl)
  if (!destination) notFound()

  if (customer && !preview) {
    const entry = { customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind }
    after(() => recordItemAccessSafely(entry))
  }
  redirect(destination)
}
