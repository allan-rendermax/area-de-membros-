import { previewContext, previewIncludesDrafts, previewAccessLevel } from '@/lib/membros/preview-context'
import { renderItemContent } from '@/components/membros/item-content'
import { CommunityWhatsapp } from '@/components/membros/community-whatsapp'
import { InstallAppButton } from '@/components/membros/install-app-button'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ProductUpgrade } from '@/components/membros/product-upgrade'
import { LockedModules } from '@/components/membros/locked-modules'
import { StoreHeader } from '@/components/membros/store-header'
import { WhatsAppFloating } from '@/components/membros/whatsapp-button'
import { canAccessProductModule } from '@/lib/access/product-content'
import { loadGrantedProductLevels } from '@/lib/data/access'
import { getProductBySlug, listModulesWithItems } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'
import { supportHref } from '@/lib/support/whatsapp'
import { isHttpUrl } from '@/lib/content/url'
import { toVideoEmbed } from '@/lib/content/video'
import { requireStorePreview } from '@/lib/membros/preview'
import { withPreview } from '@/lib/membros/paths'
import { loadProductComplement } from '@/lib/data/product-complement'
import { ProductComplementCard, ProductComplementOffer } from '@/components/membros/product-complement'
import { loadContextualInput,contextualLegacyComplement } from '@/lib/data/contextual-page'
import { projectProductComplements } from '@/lib/access/contextual-complements'
import { ContextualComplementShelves } from '@/components/membros/contextual-complement-shelves'
import { ContextualProductHeader } from '@/components/membros/contextual-product-header'

export const dynamic = 'force-dynamic'

export default async function ProdutoPage({ params, searchParams }: PageProps<'/[loja]/produto/[slug]'>) {
  const { loja, slug } = await params
  const query = await searchParams
  const preview = previewContext(query)
  const editorial = previewIncludesDrafts(preview)
  const { store, customer } = await (preview ? requireStorePreview(loja) : requireStoreSession(loja))
  const [product, levels] = await Promise.all([
    getProductBySlug(store.id, slug),
    customer ? loadGrantedProductLevels(store.id, customer) : Promise.resolve(null),
  ])
  if (!product || (!editorial && !product.isPublished)) notFound()
  const complementScenario=typeof query.complementos==='string'?query.complementos:undefined
  const contextualInput=store.memberLibraryMode==='grouped'?await loadContextualInput(store.id,new Set(levels?.keys()),preview,complementScenario):undefined
  const level = preview ? (contextualInput && !contextualInput.granted.has(product.id)?undefined:previewAccessLevel(preview)) : levels?.get(product.id)
  if (!level) redirect(withPreview(`/${store.slug}?comprar=${product.slug}`, preview,complementScenario))

  const publishedModules = (await listModulesWithItems(product.id, { publishedOnly: !editorial }))
    .filter((module) => editorial || module.isPublished)
    .map((module) => ({ ...module, items: module.items.filter((item) => (editorial || item.isPublished) && (item.kind === 'video' ? Boolean(toVideoEmbed(item.url)) : isHttpUrl(item.url))) }))
    .filter((module) => module.items.length > 0)
  const modules = publishedModules.filter((module) => canAccessProductModule(level, module.requiredLevel, product.contentMode, editorial))
  const lockedModules = publishedModules.filter((module) => !editorial && level === 'basic' && !canAccessProductModule(level, module.requiredLevel, product.contentMode, editorial))
  const productHref = withPreview(`/${store.slug}/produto/${product.slug}`, preview, complementScenario)
  const blocked = !editorial && query.bloqueado === '1'
  const firstItem = modules[0]?.items[0]
  if (firstItem) {
    return renderItemContent({
      ctx: { item: firstItem, module: modules[0], product },
      store, customer, level, preview, blocked, productModules: publishedModules, contextualInput, complementScenario, requestedComplement:typeof query.complemento==='string'?query.complemento:undefined,
    })
  }
  const support = supportHref(store, 'geral', customer?.email ?? null)
  const contextual=contextualInput?projectProductComplements(contextualInput,product.id):null
  const complement = contextualInput?contextualLegacyComplement(contextualInput,product,store.slug,preview):await loadProductComplement(product, store.slug, customer, preview)
  const backHref=withPreview(contextual?.backParent?`/${store.slug}/produto/${contextual.backParent.slug}`:`/${store.slug}#materiais`,preview,complementScenario)

  return (
    <>
      <StoreHeader store={store} email={customer?.email ?? ''} preview={preview} complementScenario={complementScenario} simulationHref={product.isPublished ? undefined : `/${store.slug}`} actions={<InstallAppButton />} legacyHome />
      <main className="lesson-workspace mx-auto w-full max-w-[1440px] px-4 pt-7 pb-24 sm:px-8 sm:pt-10 lg:px-10">
        {contextual && <ContextualProductHeader product={product} level={level} backHref={backHref} ownedCount={contextual.owned.length} optionalCount={contextual.optional.length}/>}
        <div id="seu-material" className="lesson-workspace-grid grid min-w-0 scroll-mt-28 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,34%)] xl:gap-10">
          <div className="min-w-0">
            {!contextual && <header className="lesson-heading flex min-w-0 items-start gap-4">
              <Link href={withPreview(`/${store.slug}#materiais`, preview)} aria-label="Voltar ao acervo" className="lesson-back grid h-11 w-11 shrink-0 place-items-center rounded-full border border-borda bg-superficie text-xl text-texto hover:bg-superficie-2">←</Link>
              <div className="min-w-0 flex-1">
                <p className="lesson-eyebrow text-xs font-bold uppercase tracking-[.16em] text-texto-suave">Seu material</p>
                <h1 className="lesson-title mt-1 break-words [overflow-wrap:anywhere] text-3xl font-extrabold leading-tight sm:text-4xl">{product.title}</h1>
                {blocked && <p role="status" className="mt-3 rounded-xl border border-borda bg-superficie px-4 py-3 text-sm">Este conteúdo não faz parte da sua versão atual.</p>}
                {product.description && <p className="mt-3 max-w-2xl break-words text-sm leading-relaxed text-texto-suave sm:text-base">{product.description}</p>}
              </div>
            </header>}

            <p className="mt-10 text-texto-suave">{lockedModules.length ? 'Nenhum conteúdo disponível no seu acesso atual.' : 'Nenhum conteúdo publicado ainda.'}</p>
            <LockedModules modules={lockedModules} />
            {complement && <ProductComplementOffer complement={complement} />}
            <ProductUpgrade level={level} lockedCount={lockedModules.length} checkoutUrl={product.upgradeCheckoutUrl} refreshHref={productHref} productTitle={product.title} imageUrl={product.upgradeImageUrl || product.coverUrl} buttonText={product.upgradeButtonText} supportUrl={support} />
          </div>
          {complement && <aside className="min-w-0" aria-label="Conteúdos do produto"><div className="rounded-2xl border border-borda bg-superficie p-5 sm:p-6"><h2 className="text-2xl font-bold">Conteúdos</h2><div className="mt-5"><ProductComplementCard complement={complement} /></div></div></aside>}
        </div>
        {contextual && <ContextualComplementShelves complements={contextual} storeSlug={store.slug} preview={preview} complementScenario={complementScenario} requestedSlug={typeof query.complemento==='string'?query.complemento:undefined}/>}
      </main>
      <CommunityWhatsapp url={store.communityWhatsappUrl} />
      <WhatsAppFloating href={support} />
    </>
  )
}
