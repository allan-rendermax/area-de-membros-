import { notFound, redirect } from 'next/navigation'
import { renderItemContent } from '@/components/membros/item-content'
import { toVideoEmbed } from '@/lib/content/video'
import { isHttpUrl, isUuid } from '@/lib/content/url'
import { canAccessProductModule } from '@/lib/access/product-content'
import { loadGrantedProductLevels } from '@/lib/data/access'
import { getItemWithContext } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'
import { requireStorePreview } from '@/lib/membros/preview'

export const dynamic = 'force-dynamic'

export default async function ItemPage({ params, searchParams }: PageProps<'/[loja]/item/[id]'>) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()
  const query = await searchParams
  const preview = query.previa === '1'
  const blocked = !preview && query.bloqueado === '1'
  const { store, customer } = await (preview ? requireStorePreview(loja) : requireStoreSession(loja))

  const [ctx, levels] = await Promise.all([
    getItemWithContext(id),
    customer ? loadGrantedProductLevels(store.id, customer) : Promise.resolve(null),
  ])
  if (!ctx || ctx.product.storeId !== store.id || (!preview && (!ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished))) notFound()
  const level = preview ? 'complete' : levels?.get(ctx.product.id)
  if (!level) redirect(`/${store.slug}?comprar=${ctx.product.slug}`)
  if (!canAccessProductModule(level, ctx.module.requiredLevel, ctx.product.contentMode, preview)) redirect(`/${store.slug}/produto/${ctx.product.slug}?bloqueado=1`)

  const embed = ctx.item.kind === 'video' ? toVideoEmbed(ctx.item.url) : null
  if (ctx.item.kind === 'video' && !embed) notFound()
  if (ctx.item.kind !== 'video' && !isHttpUrl(ctx.item.url)) notFound()
  return renderItemContent({ ctx, store, customer, level, preview, blocked })
}
