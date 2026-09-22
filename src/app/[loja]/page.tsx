import { InstallAppButton } from '@/components/membros/install-app-button'
import { Carousel } from '@/components/membros/carousel'
import { Hero } from '@/components/membros/hero'
import { LockedPoster } from '@/components/membros/locked-poster'
import { PosterLink } from '@/components/membros/poster-card'
import { StoreHeader } from '@/components/membros/store-header'
import { WhatsAppFloating } from '@/components/membros/whatsapp-button'
import { buildShelf, buildTracks } from '@/lib/access/access'
import { loadStoreAccess } from '@/lib/data/access'
import { listRecentProductIds } from '@/lib/data/item-access'
import { requireStoreSession } from '@/lib/membros/session'
import { supportHref } from '@/lib/support/whatsapp'
import { getMemberTheme, withMemberArtwork } from '@/lib/membros/theme'
import { ArchitectureHero } from '@/components/membros/architecture-hero'

export const dynamic = 'force-dynamic'

export default async function VitrinePage({ params, searchParams }: PageProps<'/[loja]'>) {
  const [{ loja }, { comprar }] = await Promise.all([params, searchParams])
  const { store, customer } = await requireStoreSession(loja)
  const [{ products, granted }, recentIds] = await Promise.all([
    loadStoreAccess(store.id, customer),
    listRecentProductIds(customer.id, store.id),
  ])
  const architecture = getMemberTheme(store.slug) === 'arquitetura'
  const shelf = buildShelf(products.map((product) => withMemberArtwork(product, store.slug)), granted)
  const tracks = buildTracks(shelf)
  const continuing = recentIds.flatMap((id) => shelf.unlocked.filter((p) => p.id === id))
  const openSlug = typeof comprar === 'string' ? comprar : null
  const support = supportHref(store, 'geral', customer.email)

  return (
    <>
      <StoreHeader store={store} email={customer.email} actions={<InstallAppButton />} />
      <main className="pb-24">
        {architecture ? <ArchitectureHero /> : shelf.featured && <Hero product={shelf.featured} storeSlug={store.slug} />}
        {architecture && (
          <div id="materiais" className="arq-library-heading">
            <h2>Tudo pronto para você criar</h2>
            <p>Seu acervo de arquitetura, em um só lugar.</p>
          </div>
        )}
        <div className={`relative flex flex-col gap-8 ${architecture ? '' : shelf.featured ? '-mt-2 sm:-mt-8' : 'pt-6'}`}>
          {continuing.length > 0 && (
            <Carousel title="Continuar">
              {continuing.map((p) => (
                <PosterLink key={p.id} product={p} href={`/${store.slug}/produto/${p.slug}`} />
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
                  ? <PosterLink key={p.id} product={p} href={`/${store.slug}/produto/${p.slug}`} />
                  : <LockedPoster key={`${p.id}-${openSlug === p.slug}`} product={p} initiallyOpen={openSlug === p.slug} />
              ))}
            </Carousel>
          ))}
        </div>
      </main>
      <WhatsAppFloating href={support} />
    </>
  )
}
