import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { isValidStoreSlug } from '@/lib/content/slug'
import { findCustomerByEmail } from '@/lib/data/customers'
import { getStoreBySlug } from '@/lib/data/stores'
import type { CustomerRow, Store } from '@/lib/domain/types'
import { createClient } from '@/lib/supabase/server'

export const getStore = cache(async (slug: string): Promise<Store> => {
  if (!isValidStoreSlug(slug)) notFound()
  const store = await getStoreBySlug(slug)
  if (!store) notFound()
  return store
})

export async function requireStoreSession(slug: string): Promise<{ store: Store; customer: CustomerRow }> {
  const [store, { supabase, data }] = await Promise.all([
    getStore(slug),
    (async () => {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      return { supabase, data }
    })(),
  ])
  const email = data.user?.email
  if (!email) redirect(`/${store.slug}/entrar`)

  const customer = await findCustomerByEmail(email)
  if (!customer || customer.blockedAt) {
    await supabase.auth.signOut()
    redirect(`/${store.slug}/entrar`)
  }
  return { store, customer }
}
