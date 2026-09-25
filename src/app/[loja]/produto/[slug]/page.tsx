import { renderItemContent } from '@/components/membros/item-content'
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

export const dynamic = 'force-dynamic'

export default async function ProdutoPage({ params, searchParams }: PageProps<'/[loja]/produto/[slug]'>) {
  const { loja, slug } = await params
  const query = await searchParams
  const preview = query.previa === '1'
  const { store, customer } = await (preview ? requireStorePreview(loja) : requireStoreSession(loja))
  const [product, levels] = await Promise.all([
    getProductBySlug(store.id, slug),
    customer ? loadGrantedProductLevels(store.id, customer) : Promise.resolve(null),
  ])
  if (!product || (!preview && !product.isPublished)) notFound()
  const level = preview ? 'complete' : levels?.get(product.id)
  if (!level) redirect(`/${store.slug}?comprar=${product.slug}`)

  const publishedModules = (await listModulesWithItems(product.id, { publishedOnly: !preview }))
    .filter((module) => preview || module.isPublished)
    .map((module) => ({ ...module, items: module.items.filter((item) => (preview || item.isPublished) && (item.kind === 'video' ? Boolean(toVideoEmbed(item.url)) : isHttpUrl(item.url))) }))
    .filter((module) => module.items.length > 0)
  const modules = publishedModules.filter((module) => canAccessProductModule(level, module.requiredLevel, product.contentMode, preview))
  const lockedModules = publishedModules.filter((module) => !preview && level === 'basic' && !canAccessProductModule(level, module.requiredLevel, product.contentMode, preview))
  const productHref = withPreview(`/${store.slug}/produto/${product.slug}`, preview)
  const blocked = !preview && query.bloqueado === '1'
  const firstItem = modules[0]?.items[0]
  if (firstItem) {
    return renderItemContent({
      ctx: { item: firstItem, module: modules[0], product },
      store, customer, level, preview, blocked, productModules: publishedModules,
    })
  }
  const support = supportHref(store, 'geral', customer?.email ?? null)

  return (
    <>
      <StoreHeader store={store} email={customer?.email ?? ''} preview={preview} actions={<InstallAppButton />} legacyHome />
      <main className="lesson-workspace mx-auto w-full max-w-[1440px] px-4 pt-7 pb-24 sm:px-8 sm:pt-10 lg:px-10">
        <div className="lesson-workspace-grid grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,34%)] xl:gap-10">
          <div className="min-w-0">
            <header className="lesson-heading flex min-w-0 items-start gap-4">
              <Link href={withPreview(`/${store.slug}#materiais`, preview)} aria-label="Voltar ao acervo" className="lesson-back grid h-11 w-11 shrink-0 place-items-center rounded-full border border-borda bg-superficie text-xl text-texto hover:bg-superficie-2">←</Link>
              <div className="min-w-0 flex-1">
                <p className="lesson-eyebrow text-xs font-bold uppercase tracking-[.16em] text-texto-suave">Seu material</p>
                <h1 className="lesson-title mt-1 break-words [overflow-wrap:anywhere] text-3xl font-extrabold leading-tight sm:text-4xl">{product.title}</h1>
                {blocked && <p role="status" className="mt-3 rounded-xl border border-borda bg-superficie px-4 py-3 text-sm">Este conteúdo não faz parte da sua versão atual.</p>}
                {product.description && <p className="mt-3 max-w-2xl break-words text-sm leading-relaxed text-texto-suave sm:text-base">{product.description}</p>}
              </div>
            </header>

            <p className="mt-10 text-texto-suave">{lockedModules.length ? 'Nenhum conteúdo disponível no seu acesso atual.' : 'Nenhum conteúdo publicado ainda.'}</p>
            <LockedModules modules={lockedModules} />
            <ProductUpgrade level={level} lockedCount={lockedModules.length} checkoutUrl={product.upgradeCheckoutUrl} refreshHref={productHref} productTitle={product.title} imageUrl={product.upgradeImageUrl || product.coverUrl} buttonText={product.upgradeButtonText} supportUrl={support} />
          </div>
        </div>
      </main>
      <WhatsAppFloating href={support} />
    </>
  )
}
