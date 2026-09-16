'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { saveMaterial, uploadCover } from '@/lib/data/catalog'
import { getDefaultStore } from '@/lib/data/stores'

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim()
}

export async function salvarMaterial(formData: FormData) {
  await requireAdmin()
  const store = await getDefaultStore()

  let coverUrl = text(formData, 'cover_url') || null
  const cover = formData.get('cover')
  if (cover instanceof File && cover.size > 0) coverUrl = await uploadCover(cover)

  await saveMaterial({
    id: text(formData, 'id') || null,
    storeId: store.id,
    title: text(formData, 'title'),
    description: text(formData, 'description'),
    coverUrl,
    downloadUrl: text(formData, 'download_url'),
    checkoutUrl: text(formData, 'checkout_url') || null,
    sortOrder: Number(text(formData, 'sort_order') || 0),
    isPublished: formData.get('is_published') === 'on',
  })

  revalidatePath('/admin/materiais')
  revalidatePath('/')
  redirect('/admin/materiais')
}
