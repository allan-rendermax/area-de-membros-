import type { OfferGroupInput, OfferPlanInput } from '@/lib/admin/offer-groups'
import type { AccessLevel } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

export type AdminOfferGroup = { id: string; name: string; version: number; plans: OfferPlanInput[] }
type DbGroup = {
  id: string; name: string; version: number
  offers: { id: string; name: string; payt_product_code: string; offer_products: { product_id: string; grant_level: AccessLevel }[] }[]
}
const columns = 'id, name, version, offers(id, name, payt_product_code, offer_products(product_id, grant_level))'
function fromRow(row: DbGroup): AdminOfferGroup {
  return { id: row.id, name: row.name, version: row.version, plans: row.offers.map(p => ({
    id: p.id, name: p.name, paytProductCode: p.payt_product_code,
    grants: p.offer_products.map(g => ({ productId: g.product_id, level: g.grant_level })),
  })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }
}
function databaseError(error: { code?: string; message: string }): Error {
  if (['PGRST202', 'PGRST200', 'PGRST205', '42883', '42P01', '42703'].includes(error.code ?? '')) {
    return new Error('A migração de ofertas com planos precisa ser aplicada antes de usar este cadastro.')
  }
  if (error.code === '23505') return new Error('Este código da Payt já está cadastrado em outro plano.')
  return new Error(error.message)
}
export async function listOfferGroups(storeId: string): Promise<AdminOfferGroup[]> {
  const { data, error } = await createAdminClient().from('offer_groups').select(columns).eq('store_id', storeId).order('name')
  if (error) throw databaseError(error)
  return (data as unknown as DbGroup[]).map(fromRow)
}
export async function getOfferGroup(id: string, storeId: string): Promise<AdminOfferGroup | null> {
  const db = createAdminClient()
  const { data, error } = await db.from('offer_groups').select(columns).eq('id', id).eq('store_id', storeId).maybeSingle()
  if (error) throw databaseError(error)
  if (data) return fromRow(data as unknown as DbGroup)
  // Bookmarks to the old single-code editor still open the correct offer.
  const { data: plan, error: planError } = await db.from('offers').select('group_id').eq('id', id).eq('store_id', storeId).maybeSingle()
  if (planError) throw databaseError(planError)
  if (!plan) return null
  const result = await db.from('offer_groups').select(columns).eq('id', plan.group_id).eq('store_id', storeId).maybeSingle()
  if (result.error) throw databaseError(result.error)
  return result.data ? fromRow(result.data as unknown as DbGroup) : null
}
export async function saveOfferGroup(input: OfferGroupInput): Promise<string> {
  const { data, error } = await createAdminClient().rpc('save_offer_group_atomic', {
    p_id: input.id, p_store_id: input.storeId, p_name: input.name, p_version: input.version,
    p_plans: input.plans.map(p => ({ id: p.id, name: p.name, payt_product_code: p.paytProductCode,
      grants: p.grants.map(g => ({ product_id: g.productId, grant_level: g.level })),
    })),
  })
  if (error) throw databaseError(error)
  return data as string
}
export async function deleteOfferGroup(input: { id: string; storeId: string; confirmation: string }): Promise<void> {
  const { error } = await createAdminClient().rpc('delete_offer_group_atomic', {
    p_id: input.id, p_store_id: input.storeId, p_confirmation: input.confirmation,
  })
  if (error) throw databaseError(error)
}
