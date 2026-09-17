import { cookies } from 'next/headers'
import { getDefaultStore, getStoreBySlug } from '@/lib/data/stores'
import type { Store } from '@/lib/domain/types'

export const ADMIN_STORE_COOKIE = 'admin_loja'

export async function getAdminStore(): Promise<Store> {
  const slug = (await cookies()).get(ADMIN_STORE_COOKIE)?.value
  return (slug ? await getStoreBySlug(slug) : null) ?? getDefaultStore()
}
