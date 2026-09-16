import type { Store } from '@/lib/domain/types'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const { data, error } = await createAdminClient()
    .from('stores')
    .select('id, slug, name, logo_url, primary_color, support_url')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
    supportUrl: data.support_url,
  }
}

export async function getDefaultStore(): Promise<Store> {
  const store = await getStoreBySlug(env.defaultStoreSlug)
  if (!store) throw new Error(`Loja não encontrada: ${env.defaultStoreSlug}`)
  return store
}
