import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { Carousel } from '@/components/membros/carousel'
import { LockedPoster } from '@/components/membros/locked-poster'
import { PosterLink } from '@/components/membros/poster-card'
import { buildShelf, buildTracks } from '@/lib/access/access'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { loadStoreAccess } from '@/lib/data/access'
import { getCustomer } from '@/lib/data/customers'
import { listRecentProductIds } from '@/lib/data/item-access'

export default async function ClienteVitrinePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  if (!isUuid(id)) notFound()
  const customer = await getCustomer(id)
  if (!customer) notFound()
  const store = await getAdminStore()
  const [{ products, granted }, recentIds] = await Promise.all([
    loadStoreAccess(store.id, customer.email),
    listRecentProductIds(customer.id, store.id),
  ])
  const shelf = buildShelf(products, granted)
  const tracks = buildTracks(shelf)
  const continuing = recentIds.flatMap((recentId) => shelf.unlocked.filter((p) => p.id === recentId))
  const previewHref = `/admin/clientes/${id}/vitrine`

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className={ui.notice}>
        <p>Prévia do que {customer.email} vê na loja {store.name}. Somente leitura.</p>
        <Link href={`/admin/clientes/${id}`} className="mt-2 inline-block underline">Voltar para a ficha</Link>
      </div>
      <div className="relative flex flex-col gap-8 pt-6">
        {continuing.length > 0 && (
          <Carousel title="Continuar">
            {continuing.map((p) => <PosterLink key={p.id} product={p} href={previewHref} />)}
          </Carousel>
        )}
        {shelf.unlocked.length === 0 && (
          <section className="mx-4 rounded-lg border border-borda bg-superficie p-6 sm:mx-8">
            <h2 className="text-lg font-semibold">Nenhum produto liberado ainda</h2>
            <p className="mt-2 max-w-prose text-texto-suave">
              Seus produtos aparecem aqui assim que o pagamento é confirmado. Se você já pagou e nada apareceu, fale com a gente.
            </p>
          </section>
        )}
        {tracks.map((track) => (
          <Carousel key={track.name} title={track.name}>
            {track.products.map((p) => (
              p.unlocked
                ? <PosterLink key={p.id} product={p} href={previewHref} />
                : <LockedPoster key={p.id} product={{ ...p, checkoutUrl: null }} />
            ))}
          </Carousel>
        ))}
      </div>
    </div>
  )
}
