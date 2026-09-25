'use client'

import { DeleteOfferSection } from './delete-offer-form'
import { excluirGrupoOferta } from './group-actions'

export function DeleteGroupSection({ offer, storeId }: { offer: { id: string; name: string }; storeId: string }) {
  return <DeleteOfferSection offer={offer} storeId={storeId} deleteAction={excluirGrupoOferta} grouped />
}
