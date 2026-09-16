import { notFound } from 'next/navigation'
import { getOffer, listMaterials } from '@/lib/data/catalog'
import { getDefaultStore } from '@/lib/data/stores'
import { OfferForm } from '../offer-form'

export default async function OfertaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const store = await getDefaultStore()
  const [offer, materials] = await Promise.all([id === 'novo' ? null : getOffer(id), listMaterials(store.id)])
  if (id !== 'novo' && !offer) notFound()

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{offer ? 'Editar oferta' : 'Nova oferta'}</h1>
      <OfferForm offer={offer} materials={materials} />
    </div>
  )
}
