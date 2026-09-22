import { cookies } from 'next/headers'
import { getDefaultStore, getStoreBySlug } from '@/lib/data/stores'
import type { Store } from '@/lib/domain/types'

export const ADMIN_STORE_COOKIE = 'admin_loja'
export const STORE_CONTEXT_CHANGED = 'A loja foi alterada em outra aba. Recarregue a página antes de salvar.'

export function assertAdminStoreContext(form: FormData, storeId: string): void {
  if (form.get('store_id') !== storeId) throw new Error(STORE_CONTEXT_CHANGED)
}

export async function getAdminStore(): Promise<Store> {
  const slug = (await cookies()).get(ADMIN_STORE_COOKIE)?.value
  return (slug ? await getStoreBySlug(slug) : null) ?? getDefaultStore()
}
