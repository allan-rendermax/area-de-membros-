'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { errorText, uploadIfPresent, withMessage } from '@/lib/admin/action-helpers'
import { parseStoreForm } from '@/lib/admin/forms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { uploadImage } from '@/lib/data/products-admin'
import { saveStore } from '@/lib/data/stores'
import { PUBLIC_STORES_TAG } from '@/lib/data/store-cache'

export async function salvarLoja(formData: FormData) {
  await requireAdmin()
  const currentId = String(formData.get('id') ?? '') || 'nova'
  let storeId: string
  try {
    const input = parseStoreForm(formData)
    input.logoUrl = await uploadIfPresent(formData.get('logo'), input.logoUrl, uploadImage)
    input.loginImageUrl = await uploadIfPresent(formData.get('login_image'), input.loginImageUrl, uploadImage)
    storeId = await saveStore(input)
  } catch (e) {
    redirect(withMessage(`/admin/lojas/${currentId}`, errorText(e)))
  }
  updateTag(PUBLIC_STORES_TAG)
  revalidatePath('/admin', 'layout')
  redirect(withMessage(`/admin/lojas/${storeId}`, 'Loja salva.'))
}
