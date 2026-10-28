import { contextualPreviewLevel } from '@/lib/membros/contextual-preview'
import { loadContextualInput } from '@/lib/data/contextual-page'
import { previewContext, previewIncludesDrafts } from '@/lib/membros/preview-context'
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
import { privateFilePath } from '@/lib/content/private-files'
import { downloadRedirect, downloadUnavailable } from '@/lib/content/download-response'

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
  const complementScenario = query.get('complementos') ?? undefined
  const contextualInput = preview && store.memberLibraryMode === 'grouped' ? await loadContextualInput(store.id, new Set(), preview, complementScenario) : undefined
  const level = preview ? contextualPreviewLevel(ctx.product, preview, contextualInput) : levels?.get(ctx.product.id)
  if (!level) redirect(withPreview(`/${store.slug}?comprar=${ctx.product.slug}`, preview, complementScenario))
  if (!canAccessProductModule(level, ctx.module.requiredLevel, ctx.product.contentMode, editorial)) redirect(withPreview(`/${store.slug}/produto/${ctx.product.slug}?bloqueado=1`, preview, complementScenario))

  const destination = await resolveResourceDestination(ctx.item, env.supabaseUrl, ctx.product.title)
  if (!destination) {
    if (ctx.item.kind === 'arquivo' && privateFilePath(ctx.item.url, env.supabaseUrl)) {
      const materialPath = `/${store.slug}/item/${id}`
      return downloadUnavailable(withPreview(`${materialPath}/abrir`, preview, complementScenario), withPreview(materialPath, preview, complementScenario))
    }
    notFound()
  }

  if (customer && !preview) {
    const entry = { customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind }
    after(() => recordItemAccessSafely(entry))
  }
  return downloadRedirect(destination)
}
