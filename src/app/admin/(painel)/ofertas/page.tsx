import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listProducts } from '@/lib/data/products'
import { listOfferGroups } from '@/lib/data/offer-groups'

export default async function OfertasPage({ searchParams }: PageProps<'/admin/ofertas'>) {
  await requireAdmin()
  const { msg } = await searchParams
  const store = await getAdminStore()
  const [offers, products] = await Promise.all([listOfferGroups(store.id), listProducts(store.id)])
  const titles = new Map(products.map((p) => [p.id, p.title]))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className={ui.h1}>Ofertas — {store.name}</h1>
        <Link href="/admin/ofertas/novo" className={ui.button}>Nova oferta</Link>
      </div>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      <ul className={`${ui.card} divide-y divide-borda`}>
        {offers.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/ofertas/${o.id}`} className="block px-4 py-3 hover:bg-superficie-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{o.name}</span>
                <span className="text-sm text-texto-suave">{o.plans.length} {o.plans.length === 1 ? 'plano' : 'planos'}</span>
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {o.plans.map(plan => <li key={plan.id} className="text-sm">
                  <span>{plan.name}</span> <span className="break-all text-texto-suave">({plan.paytProductCode})</span>
                  <span className="block text-texto-suave">{plan.grants.map(g => `${titles.get(g.productId) ?? 'Produto'} — ${g.level === 'basic' ? 'Básico' : 'Completo'}`).join(' · ') || 'Nenhum produto'}</span>
                </li>)}
              </ul>
            </Link>
          </li>
        ))}
        {offers.length === 0 && <li className="px-4 py-3 text-texto-suave">Nenhuma oferta cadastrada.</li>}
      </ul>
    </div>
  )
}
