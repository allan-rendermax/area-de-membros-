import Link from 'next/link'
import { listMaterials, listOffers } from '@/lib/data/catalog'
import { getDefaultStore } from '@/lib/data/stores'

export default async function OfertasPage() {
  const store = await getDefaultStore()
  const [offers, materials] = await Promise.all([listOffers(store.id), listMaterials(store.id)])
  const titles = new Map(materials.map((m) => [m.id, m.title]))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Ofertas</h1>
        <Link href="/admin/ofertas/novo" className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">Nova oferta</Link>
      </div>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {offers.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/ofertas/${o.id}`} className="block px-4 py-3">
              <span className="font-medium">{o.name}</span>{' '}
              <span className="text-sm text-zinc-500">({o.paytProductCode})</span>
              <span className="block text-sm text-zinc-600">
                {o.materialIds.map((id) => titles.get(id)).filter(Boolean).join(' · ') || 'Nenhum material'}
              </span>
            </Link>
          </li>
        ))}
        {offers.length === 0 && <li className="px-4 py-3 text-zinc-500">Nenhuma oferta cadastrada.</li>}
      </ul>
    </div>
  )
}
