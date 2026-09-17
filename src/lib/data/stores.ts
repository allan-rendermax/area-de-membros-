import type { Store } from '@/lib/domain/types'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

export const STORE_COLUMNS = 'id, slug, name, logo_url, primary_color, support_url, support_whatsapp, login_image_url'

type DbStore = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  primary_color: string
  support_url: string | null
  support_whatsapp: string | null
  login_image_url: string | null
}

export function toStore(row: DbStore): Store {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    supportUrl: row.support_url,
    supportWhatsapp: row.support_whatsapp,
    loginImageUrl: row.login_image_url,
  }
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const { data, error } = await createAdminClient().from('stores').select(STORE_COLUMNS).eq('slug', slug).maybeSingle()
  if (error) throw error
  return data ? toStore(data as DbStore) : null
}

export async function getStoreById(id: string): Promise<Store | null> {
  const { data, error } = await createAdminClient().from('stores').select(STORE_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toStore(data as DbStore) : null
}

export async function getDefaultStore(): Promise<Store> {
  const store = await getStoreBySlug(env.defaultStoreSlug)
  if (!store) throw new Error(`Loja não encontrada: ${env.defaultStoreSlug}`)
  return store
}
