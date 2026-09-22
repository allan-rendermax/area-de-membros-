import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { listProducts } from '@/lib/data/products'
import { getOffer } from '@/lib/data/products-admin'
import { OfferForm } from '../offer-form'

export default async function OfertaPage({ params, searchParams }: PageProps<'/admin/ofertas/[id]'>) {
  await requireAdmin()
  const [{ id }, { codigo, msg }] = await Promise.all([params, searchParams])
  const store = await getAdminStore()
  const [offer, products] = await Promise.all([
    id !== 'novo' && isUuid(id) ? getOffer(id, store.id) : Promise.resolve(null),
    listProducts(store.id),
  ])
  if (id !== 'novo' && !offer) notFound()

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/ofertas" className="text-sm text-texto-suave hover:text-texto">← Ofertas</Link>
      <h1 className={ui.h1}>{offer ? 'Editar oferta' : `Nova oferta — ${store.name}`}</h1>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      <OfferForm offer={offer} products={products} initialCode={typeof codigo === 'string' ? codigo : ''} storeId={store.id} />
    </div>
  )
}
