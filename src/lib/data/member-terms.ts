import { createAdminClient } from '@/lib/supabase/admin'

export const MEMBER_TERMS_VERSION = '2026-09-26'

export function requiresMemberTerms(storeSlug: string): boolean {
  return storeSlug === 'arquitetura'
}

export async function hasAcceptedMemberTerms(customerId: string, storeId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from('member_terms_acceptance')
    .select('accepted_at')
    .eq('customer_id', customerId)
    .eq('store_id', storeId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data?.accepted_at)
}

export async function acceptMemberTerms(customerId: string, storeId: string): Promise<void> {
  // O banco define a data. Em novo envio, preserva o primeiro aceite.
  const { error } = await createAdminClient().from('member_terms_acceptance').upsert({
    customer_id: customerId,
    store_id: storeId,
    terms_version: MEMBER_TERMS_VERSION,
  }, { onConflict: 'customer_id,store_id', ignoreDuplicates: true })
  if (error) throw error
}
