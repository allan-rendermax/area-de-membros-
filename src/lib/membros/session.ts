import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { isValidStoreSlug } from '@/lib/content/slug'
import { findCustomerByEmail } from '@/lib/data/customers'
import { getStoreBySlug } from '@/lib/data/stores'
import { hasAcceptedMemberTerms, requiresMemberTerms } from '@/lib/data/member-terms'
import type { CustomerRow, Store } from '@/lib/domain/types'
import { createClient } from '@/lib/supabase/server'

export const getStore = cache(async (slug: string): Promise<Store> => {
  if (!isValidStoreSlug(slug)) notFound()
  const store = await getStoreBySlug(slug)
  if (!store) notFound()
  return store
})

// Apenas boas-vindas e sua ação usam identidade sem exigir o aceite prévio.
export async function requireStoreIdentity(slug: string): Promise<{ store: Store; customer: CustomerRow }> {
  const [store, { data }] = await Promise.all([
    getStore(slug),
    (async () => {
      const supabase = await createClient()
      return supabase.auth.getUser()
    })(),
  ])
  const email = data.user?.email
  if (!email) redirect(`/${store.slug}/entrar`)

  const customer = await findCustomerByEmail(email)
  if (!customer || customer.blockedAt) {
    // Deny this page without revoking other sessions (including legacy admin
    // cookies). Rendering or prefetching a store page must never log users out.
    redirect(`/${store.slug}/entrar`)
  }
  return { store, customer }
}

export async function requireStoreSession(slug: string): Promise<{ store: Store; customer: CustomerRow }> {
  const session = await requireStoreIdentity(slug)
  if (requiresMemberTerms(session.store.slug) && !await hasAcceptedMemberTerms(session.customer.id, session.store.id)) {
    redirect(`/${session.store.slug}/boas-vindas`)
  }
  return session
}
