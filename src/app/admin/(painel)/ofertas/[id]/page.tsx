import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { listProducts, listModulesWithItems } from '@/lib/data/products'
import { assessProductReadiness } from '@/lib/access/product-readiness'
import { getOffer } from '@/lib/data/products-admin'
import { OfferForm } from '../offer-form'
import { DeleteOfferSection } from '../delete-offer-form'

export default async function OfertaPage({ params, searchParams }: PageProps<'/admin/ofertas/[id]'>) {
  await requireAdmin()
  const [{ id }, { codigo, msg }] = await Promise.all([params, searchParams])
  const store = await getAdminStore()
  const [offer, products] = await Promise.all([
    id !== 'novo' && isUuid(id) ? getOffer(id, store.id) : Promise.resolve(null),
    listProducts(store.id),
  ])
  if (id !== 'novo' && !offer) notFound()
  const warnings = offer ? (await Promise.all(products.filter((p) => offer.productIds.includes(p.id)).map(async (product) => {
    if (!product.isPublished) return `${product.title}: produto não publicado; a entrega está indisponível.`
    const modules = await listModulesWithItems(product.id, { publishedOnly: false })
    const result = assessProductReadiness({ mode: product.contentMode ?? 'sections', modules, offeredLevels: [offer.productLevels?.[product.id] ?? 'complete'] })
    return result.emptyLevels.length ? `${product.title}: o nível ${result.emptyLevels[0] === 'basic' ? 'Básico' : 'Completo'} desta oferta não tem material publicado utilizável.` : null
  }))).filter(Boolean) : []

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/ofertas" className="text-sm text-texto-suave hover:text-texto">← Ofertas</Link>
      <h1 className={ui.h1}>{offer ? 'Editar oferta' : `Nova oferta — ${store.name}`}</h1>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      {warnings.length > 0 && <div role="status" className={ui.notice}><strong>Revise a entrega desta oferta</strong><ul className="mt-2 list-disc pl-5">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><p className="mt-2">A configuração existente foi preservada. Corrija os materiais antes de continuar vendendo.</p></div>}
      <OfferForm offer={offer} products={products} initialCode={typeof codigo === 'string' ? codigo : ''} storeId={store.id} />
      {offer && <DeleteOfferSection key={offer.id} offer={{ id: offer.id, name: offer.name }} storeId={store.id} />}
    </div>
  )
}
