import { unstable_cache } from 'next/cache'
import type { StoreInput } from '@/lib/admin/forms'
import type { Store } from '@/lib/domain/types'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { PUBLIC_STORES_REVALIDATE, PUBLIC_STORES_TAG } from './store-cache'

export const STORE_COLUMNS = 'id, slug, name, logo_url, support_url, support_whatsapp, login_image_url'

type DbStore = {
  id: string
  slug: string
  name: string
  logo_url: string | null
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
    supportUrl: row.support_url,
    supportWhatsapp: row.support_whatsapp,
    loginImageUrl: row.login_image_url,
  }
}

export const getStoreBySlug = unstable_cache(async (slug: string): Promise<Store | null> => {
  const { data, error } = await createAdminClient().from('stores').select(STORE_COLUMNS).eq('slug', slug).maybeSingle()
  if (error) throw error
  return data ? toStore(data as DbStore) : null
}, ['public-store-by-slug-v1'], { tags: [PUBLIC_STORES_TAG], revalidate: PUBLIC_STORES_REVALIDATE })

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

export async function listStores(): Promise<Store[]> {
  const { data, error } = await createAdminClient().from('stores').select(STORE_COLUMNS).order('name')
  if (error) throw error
  return (data as DbStore[]).map(toStore)
}

export async function saveStore(input: StoreInput): Promise<string> {
  if (input.id) {
    const currentStore = await getStoreById(input.id)
    if (currentStore?.slug === env.defaultStoreSlug && input.slug !== currentStore.slug) {
      throw new Error('O endereço da loja padrão não pode ser alterado.')
    }
  }

  const row = {
    slug: input.slug,
    name: input.name,
    logo_url: input.logoUrl,
    support_whatsapp: input.supportWhatsapp,
    support_url: input.supportUrl,
    login_image_url: input.loginImageUrl,
  }
  const db = createAdminClient()
  const { data, error } = input.id
    ? await db.from('stores').update(row).eq('id', input.id).select('id').single()
    : await db.from('stores').insert(row).select('id').single()
  if (error) throw error.code === '23505' ? new Error('Já existe uma loja com este endereço.') : error
  return data.id as string
}
