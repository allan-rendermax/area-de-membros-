'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { errorText, withMessage } from '@/lib/admin/action-helpers'
import { assertAdminStoreContext, getAdminStore } from '@/lib/admin/current-store'
import { parseOfferGroupForm } from '@/lib/admin/offer-groups'
import { assertOfferProductsReady } from '@/lib/admin/product-publication'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { deleteOfferGroup, saveOfferGroup } from '@/lib/data/offer-groups'

export type OfferGroupState = { error: string | null }

export async function salvarGrupoOferta(_previous: OfferGroupState, form: FormData): Promise<OfferGroupState> {
  await requireAdmin()
  const store = await getAdminStore()
  let id: string
  try {
    assertAdminStoreContext(form, store.id)
    const input = parseOfferGroupForm(form, store.id)
    await Promise.all(input.plans.map(plan => assertOfferProductsReady({
      id: plan.id, storeId: store.id, name: plan.name, paytProductCode: plan.paytProductCode,
      productIds: plan.grants.map(grant => grant.productId),
      productLevels: Object.fromEntries(plan.grants.map(grant => [grant.productId, grant.level])),
    })))
    id = await saveOfferGroup(input)
  } catch (error) {
    return { error: errorText(error) }
  }
  revalidatePath('/admin', 'layout')
  revalidatePath(`/${store.slug}`, 'layout')
  redirect(withMessage(`/admin/ofertas/${id}`, 'Oferta e planos salvos.'))
}

export async function excluirGrupoOferta(_previous: OfferGroupState, form: FormData): Promise<OfferGroupState> {
  await requireAdmin()
  const store = await getAdminStore()
  try {
    assertAdminStoreContext(form, store.id)
    const id = String(form.get('id') ?? '')
    const confirmation = String(form.get('confirmation') ?? '').trim()
    if (!isUuid(id)) return { error: 'Oferta inválida. Recarregue a página.' }
    if (!confirmation) return { error: 'Digite o nome da oferta para confirmar a exclusão.' }
    await deleteOfferGroup({ id, storeId: store.id, confirmation })
  } catch (error) {
    return { error: errorText(error) }
  }
  revalidatePath('/admin', 'layout')
  revalidatePath(`/${store.slug}`, 'layout')
  redirect(withMessage('/admin/ofertas', 'Oferta e planos excluídos. Os produtos foram preservados.'))
}
