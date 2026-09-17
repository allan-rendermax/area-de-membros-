'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { errorText, withMessage } from '@/lib/admin/action-helpers'
import { getAdminStore } from '@/lib/admin/current-store'
import { parseOfferForm } from '@/lib/admin/forms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { saveOffer } from '@/lib/data/products-admin'

export async function salvarOferta(formData: FormData) {
  await requireAdmin()
  const store = await getAdminStore()
  const currentId = String(formData.get('id') ?? '') || 'novo'
  try {
    await saveOffer(parseOfferForm(formData, store.id))
  } catch (e) {
    redirect(withMessage(`/admin/ofertas/${currentId}`, errorText(e)))
  }
  revalidatePath('/admin/ofertas')
  revalidatePath(`/${store.slug}`, 'layout')
  redirect(withMessage('/admin/ofertas', 'Oferta salva.'))
}
