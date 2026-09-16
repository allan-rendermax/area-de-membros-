'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { saveOffer } from '@/lib/data/catalog'
import { getDefaultStore } from '@/lib/data/stores'

export async function salvarOferta(formData: FormData) {
  await requireAdmin()
  const store = await getDefaultStore()

  await saveOffer({
    id: String(formData.get('id') ?? '') || null,
    storeId: store.id,
    name: String(formData.get('name') ?? '').trim(),
    paytProductCode: String(formData.get('payt_product_code') ?? '').trim(),
    materialIds: formData.getAll('material_ids').map(String),
  })

  revalidatePath('/admin/ofertas')
  revalidatePath('/')
  redirect('/admin/ofertas')
}
