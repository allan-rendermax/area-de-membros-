import { Carousel } from '@/components/membros/carousel'
import { Hero } from '@/components/membros/hero'
import { LockedPoster } from '@/components/membros/locked-poster'
import { PosterLink } from '@/components/membros/poster-card'
import { StoreHeader } from '@/components/membros/store-header'
import { WhatsAppFloating } from '@/components/membros/whatsapp-button'
import { buildShelf } from '@/lib/access/access'
import { loadStoreAccess } from '@/lib/data/access'
import { listRecentProductIds } from '@/lib/data/item-access'
import { requireStoreSession } from '@/lib/membros/session'
import { supportHref } from '@/lib/support/whatsapp'

export const dynamic = 'force-dynamic'

export default async function VitrinePage({ params, searchParams }: PageProps<'/[loja]'>) {
  const [{ loja }, { comprar }] = await Promise.all([params, searchParams])
  const { store, customer } = await requireStoreSession(loja)
  const [{ products, granted }, recentIds] = await Promise.all([
    loadStoreAccess(store.id, customer.email),
    listRecentProductIds(customer.id, store.id),
  ])
  const shelf = buildShelf(products, granted)
  const continuing = recentIds.flatMap((id) => shelf.unlocked.filter((p) => p.id === id))
  const openSlug = typeof comprar === 'string' ? comprar : null
  const support = supportHref(store, 'geral', customer.email)

  return (
    <>
      <StoreHeader store={store} email={customer.email} />
      <main className="pb-24">
        {shelf.featured && <Hero product={shelf.featured} storeSlug={store.slug} />}
        <div className={`relative flex flex-col gap-8 ${shelf.featured ? '-mt-2 sm:-mt-8' : 'pt-6'}`}>
          {continuing.length > 0 && (
            <Carousel title="Continuar">
              {continuing.map((p) => (
                <PosterLink key={p.id} product={p} href={`/${store.slug}/produto/${p.slug}`} />
              ))}
            </Carousel>
          )}

          {shelf.unlocked.length > 0 ? (
            <Carousel title="Seus produtos">
              {shelf.unlocked.map((p) => (
                <PosterLink key={p.id} product={p} href={`/${store.slug}/produto/${p.slug}`} />
              ))}
            </Carousel>
          ) : (
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

          {shelf.locked.length > 0 && (
            <Carousel title="Desbloqueie mais">
              {shelf.locked.map((p) => (
                <LockedPoster key={p.id} product={p} initiallyOpen={openSlug === p.slug} />
              ))}
            </Carousel>
          )}
        </div>
      </main>
      <WhatsAppFloating href={support} />
    </>
  )
}
