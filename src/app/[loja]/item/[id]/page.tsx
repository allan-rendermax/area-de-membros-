import { contextualPreviewLevel } from '@/lib/membros/contextual-preview'
import { withPreview } from '@/lib/membros/paths'
import { previewContext, previewIncludesDrafts } from '@/lib/membros/preview-context'
import { notFound, redirect } from 'next/navigation'
import { renderItemContent } from '@/components/membros/item-content'
import { toVideoEmbed } from '@/lib/content/video'
import { isHttpUrl, isUuid } from '@/lib/content/url'
import { canAccessProductModule } from '@/lib/access/product-content'
import { loadGrantedProductLevels } from '@/lib/data/access'
import { getItemWithContext } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'
import { requireStorePreview } from '@/lib/membros/preview'
import { loadContextualInput } from '@/lib/data/contextual-page'

export const dynamic = 'force-dynamic'

export default async function ItemPage({ params, searchParams }: PageProps<'/[loja]/item/[id]'>) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()
  const query = await searchParams
  const preview = previewContext(query)
  const editorial = previewIncludesDrafts(preview)
  const blocked = !editorial && query.bloqueado === '1'
  const { store, customer } = await (preview ? requireStorePreview(loja) : requireStoreSession(loja))

  const [ctx, levels] = await Promise.all([
    getItemWithContext(id),
    customer ? loadGrantedProductLevels(store.id, customer) : Promise.resolve(null),
  ])
  if (!ctx || ctx.product.storeId !== store.id || (!editorial && (!ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished))) notFound()
  const complementScenario=typeof query.complementos==='string'?query.complementos:undefined
  const contextualInput=store.memberLibraryMode==='grouped'?await loadContextualInput(store.id,new Set(levels?.keys()),preview,complementScenario):undefined
  const level = preview ? contextualPreviewLevel(ctx.product, preview, contextualInput) : levels?.get(ctx.product.id)
  if (!level) redirect(withPreview(`/${store.slug}?comprar=${ctx.product.slug}`, preview, complementScenario))
  if (!canAccessProductModule(level, ctx.module.requiredLevel, ctx.product.contentMode, editorial)) redirect(withPreview(`/${store.slug}/produto/${ctx.product.slug}?bloqueado=1`, preview, complementScenario))

  const embed = ctx.item.kind === 'video' ? toVideoEmbed(ctx.item.url) : null
  if (ctx.item.kind === 'video' && !embed) notFound()
  if (ctx.item.kind !== 'video' && !isHttpUrl(ctx.item.url)) notFound()
  return renderItemContent({ ctx, store, customer, level, preview, blocked,contextualInput,complementScenario,requestedComplement:typeof query.complemento==='string'?query.complemento:undefined })
}
