'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { errorText, withMessage } from '@/lib/admin/action-helpers'
import { assertAdminStoreContext, getAdminStore } from '@/lib/admin/current-store'
import { parseOfferForm } from '@/lib/admin/forms'
import { assertOfferProductsReady } from '@/lib/admin/product-publication'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { deleteOffer } from '@/lib/data/offer-deletion'
import { saveOffer } from '@/lib/data/products-admin'

export type DeleteOfferState = { error: string | null }

export async function excluirOferta(_previous: DeleteOfferState, formData: FormData): Promise<DeleteOfferState> {
  await requireAdmin()
  const store = await getAdminStore()
  try {
    assertAdminStoreContext(formData, store.id)
    const id = formData.get('id')
    const confirmation = formData.get('confirmation')
    if (typeof id !== 'string' || !isUuid(id)) return { error: 'Oferta inválida. Recarregue a página.' }
    if (typeof confirmation !== 'string' || !confirmation.trim()) return { error: 'Digite o nome da oferta para confirmar a exclusão.' }
    await deleteOffer({ id, storeId: store.id, confirmation: confirmation.trim() })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível excluir a oferta. Tente novamente.' }
  }
  revalidatePath('/admin', 'layout')
  revalidatePath(`/${store.slug}`, 'layout')
  redirect(withMessage('/admin/ofertas', 'Oferta excluída. Os produtos foram preservados.'))
}

export async function salvarOferta(formData: FormData) {
  await requireAdmin()
  const store = await getAdminStore()
  const currentId = String(formData.get('id') ?? '') || 'novo'
  try {
    assertAdminStoreContext(formData, store.id)
  } catch (e) {
    redirect(withMessage(currentId === 'novo' ? '/admin/ofertas/novo' : '/admin/ofertas', errorText(e)))
  }
  try {
    const input = parseOfferForm(formData, store.id)
    await assertOfferProductsReady(input)
    await saveOffer(input)
  } catch (e) {
    redirect(withMessage(`/admin/ofertas/${currentId}`, errorText(e)))
  }
  revalidatePath('/admin/ofertas')
  revalidatePath(`/${store.slug}`, 'layout')
  redirect(withMessage('/admin/ofertas', 'Oferta salva.'))
}
