import { previewContext, previewIncludesDrafts } from '@/lib/membros/preview-context'
import { InstallAppButton } from '@/components/membros/install-app-button'
import { ScrollToMaterials } from '@/components/membros/scroll-to-materials'
import { Carousel } from '@/components/membros/carousel'
import { Hero } from '@/components/membros/hero'
import { LockedPoster } from '@/components/membros/locked-poster'
import { PosterLink } from '@/components/membros/poster-card'
import { StoreHeader } from '@/components/membros/store-header'
import { WhatsAppFloating } from '@/components/membros/whatsapp-button'
import { buildShelf, buildTracks } from '@/lib/access/access'
import { loadStoreAccess } from '@/lib/data/access'
import { canAccessProductModule } from '@/lib/access/product-content'
import { resolveResumeItem } from '@/lib/membros/resume-material'
import { listRecentProductVisits } from '@/lib/data/item-access'
import { requireStoreSession } from '@/lib/membros/session'
import { supportHref } from '@/lib/support/whatsapp'
import { getMemberTheme, withMemberArtwork } from '@/lib/membros/theme'
import { ArchitectureHero } from '@/components/membros/architecture-hero'
import { requireStorePreview } from '@/lib/membros/preview'
import { withPreview } from '@/lib/membros/paths'
import { listProducts } from '@/lib/data/products'

export const dynamic = 'force-dynamic'

export default async function VitrinePage({ params, searchParams }: PageProps<'/[loja]'>) {
  const [{ loja }, query] = await Promise.all([params, searchParams])
  const { comprar } = query
  const preview = previewContext(query)
  const { store, customer } = await (preview ? requireStorePreview(loja) : requireStoreSession(loja))
  const [{ products, granted, levels }, recentVisits] = await Promise.all([
    customer ? loadStoreAccess(store.id, customer) : listProducts(store.id).then((products) => ({ products, levels: new Map<string, 'basic' | 'complete'>(), granted: new Set(preview === 'locked' ? [] : products.map((p) => p.id)) })),
    customer ? listRecentProductVisits(customer.id, store.id).catch(() => []) : Promise.resolve([]),
  ])
  const architecture = getMemberTheme(store.slug) === 'arquitetura'
  const shelf = buildShelf(products.map((product) => withMemberArtwork(product, store.slug)), granted, { includeDrafts: previewIncludesDrafts(preview) })
  const tracks = buildTracks(shelf)
  const unlockedById = new Map(shelf.unlocked.map((product) => [product.id, product]))
  const productModes = new Map(products.map((product) => [product.id, product.contentMode]))
  const continuing = [...new Set(recentVisits.map((visit) => visit.productId))].flatMap((id) => {
    const product = unlockedById.get(id)
    if (!product) return []
    const productVisits = recentVisits.filter((visit) => visit.productId === id)
    const accessibleItemIds = new Set(productVisits.filter((visit) => visit.availableItem &&
      canAccessProductModule(levels.get(id), visit.availableItem.requiredLevel, productModes.get(id))).map((visit) => visit.itemId))
    const itemId = resolveResumeItem(productVisits, accessibleItemIds)
    return [{ product, itemId }]
  })
  const openSlug = typeof comprar === 'string' ? comprar : null
  const support = supportHref(store, 'geral', customer?.email ?? null)

  return (
    <>
      <StoreHeader store={store} email={customer?.email ?? ''} preview={preview} actions={<InstallAppButton />} active="home" legacyHome />
      <main className="pb-24">
        {architecture ? <ArchitectureHero /> : shelf.featured && <Hero product={shelf.featured} storeSlug={store.slug} preview={preview} />}
        {architecture && (
          <div id="materiais" className="arq-library-heading">
            <h2>Tudo pronto para você criar</h2>
            <p>Seu acervo de arquitetura, em um só lugar.</p>
          </div>
        )}
        <div id={architecture ? undefined : 'materiais'} className={`relative flex scroll-mt-28 flex-col gap-8 ${architecture ? '' : shelf.featured ? '-mt-2 sm:-mt-8' : 'pt-6'}`}>
          {continuing.length > 0 && (
            <Carousel title="Continuar">
              {continuing.map(({ product: p, itemId }) => (
                <PosterLink key={p.id} product={p} href={withPreview(itemId ? `/${store.slug}/item/${itemId}` : `/${store.slug}/produto/${p.slug}`, preview)} />
              ))}
            </Carousel>
          )}

          {shelf.unlocked.length === 0 && (
            <section className="mx-4 rounded-lg border border-borda bg-superficie p-6 sm:mx-8">
              <h2 className="text-lg font-semibold">Nenhum produto liberado ainda</h2>
              <p className="mt-2 max-w-prose text-texto-suave">
                Seus produtos aparecem aqui assim que o pagamento é confirmado. Se você já pagou e nada apareceu, fale com a gente.
              </p>
              {support && (
                <a href={support} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-md bg-whatsapp px-4 py-2 font-semibold text-texto hover:brightness-110">
                  Falar com o suporte
                </a>
              )}
            </section>
          )}

          {tracks.map((track) => (
            <Carousel key={track.name} title={track.name}>
              {track.products.map((p) => (
                p.unlocked
                  ? <PosterLink key={p.id} product={p} href={withPreview(`/${store.slug}/produto/${p.slug}`, preview)} />
                  : <LockedPoster key={`${p.id}-${openSlug === p.slug}`} product={p} initiallyOpen={openSlug === p.slug} />
              ))}
            </Carousel>
          ))}
        </div>
        <ScrollToMaterials />
      </main>
      <WhatsAppFloating href={support} />
    </>
  )
}
