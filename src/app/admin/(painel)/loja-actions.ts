'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_STORE_COOKIE } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isValidStoreSlug } from '@/lib/content/slug'

export async function trocarLoja(formData: FormData) {
  await requireAdmin()
  const slug = String(formData.get('slug') ?? '')
  if (isValidStoreSlug(slug)) {
    ;(await cookies()).set(ADMIN_STORE_COOKIE, slug, { httpOnly: true, sameSite: 'lax', path: '/admin', maxAge: 60 * 60 * 24 * 365 })
  }
  redirect('/admin/produtos')
}
