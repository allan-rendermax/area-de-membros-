'use server'

import { revalidatePath } from 'next/cache'
import { redirect, unstable_rethrow } from 'next/navigation'
import { acceptMemberTerms, requiresMemberTerms } from '@/lib/data/member-terms'
import { isValidStoreSlug } from '@/lib/content/slug'
import { requireStoreIdentity } from '@/lib/membros/session'

export type AcceptTermsState = { error: string | null }

export async function acceptTerms(storeSlug: string, _previous: AcceptTermsState, formData: FormData): Promise<AcceptTermsState> {
  if (typeof storeSlug !== 'string' || !isValidStoreSlug(storeSlug) || formData.get('accept') !== 'yes') {
    return { error: 'Confirme o aceite dos termos para continuar.' }
  }
  try {
    const { store, customer } = await requireStoreIdentity(storeSlug)
    if (store.slug !== storeSlug || !requiresMemberTerms(store.slug)) return { error: 'Loja indisponível para este aceite.' }
    await acceptMemberTerms(customer.id, store.id)
    revalidatePath(`/${store.slug}`, 'layout')
  } catch (error) {
    unstable_rethrow(error)
    return { error: 'Não foi possível salvar seu aceite. Tente novamente.' }
  }
  redirect(`/${storeSlug}`)
}
