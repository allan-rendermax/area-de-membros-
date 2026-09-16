import type { OrderRef, OrderStatus } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

export async function listOrderRefsByEmail(storeId: string, email: string): Promise<OrderRef[]> {
  const { data, error } = await createAdminClient()
    .from('orders')
    .select('payt_product_code, status')
    .eq('store_id', storeId)
    .eq('customer_email', email)
  if (error) throw error
  return data.map((o) => ({ productCode: o.payt_product_code, status: o.status as OrderStatus }))
}

export async function getMaterialTitlesForProduct(storeId: string, productCode: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from('offers')
    .select('offer_materials(materials(title, sort_order))')
    .eq('store_id', storeId)
    .eq('payt_product_code', productCode)
    .maybeSingle()
  if (error) throw error
  if (!data) return []

  type Row = { materials: { title: string; sort_order: number } | null }
  return (data.offer_materials as unknown as Row[])
    .map((r) => r.materials)
    .filter((m): m is { title: string; sort_order: number } => m !== null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => m.title)
}
