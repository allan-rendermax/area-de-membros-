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

export async function listAllOrderRefsByEmail(email: string): Promise<OrderRef[]> {
  const { data, error } = await createAdminClient()
    .from('orders')
    .select('payt_product_code, status')
    .eq('customer_email', email)
  if (error) throw error
  return data.map((o) => ({ productCode: o.payt_product_code, status: o.status as OrderStatus }))
}

export async function getMaterialTitlesForProduct(storeId: string, productCode: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from('offers')
    .select('offer_materials(materials(title, sort_order, is_published))')
    .eq('store_id', storeId)
    .eq('payt_product_code', productCode)
    .maybeSingle()
  if (error) throw error
  if (!data) return []

  type Linked = { title: string; sort_order: number; is_published: boolean }
  type Row = { materials: Linked | null }
  return (data.offer_materials as unknown as Row[])
    .map((r) => r.materials)
    .filter((m): m is Linked => m !== null && m.is_published)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => m.title)
}

export type AdminOrder = {
  id: string
  createdAt: string
  customerEmail: string
  productCode: string
  productName: string
  status: OrderStatus
  isTest: boolean
  amountCents: number | null
  source: string
}

export type OrderFilter = 'todos' | 'problemas' | 'desconhecidas' | 'teste'

const ORDER_COLUMNS = 'id, created_at, customer_email, payt_product_code, payt_product_name, status, is_test, amount_cents, source'

type DbOrder = {
  id: string
  created_at: string
  customer_email: string
  payt_product_code: string
  payt_product_name: string
  status: string
  is_test: boolean
  amount_cents: number | null
  source: string
}

function toAdminOrder(o: DbOrder): AdminOrder {
  return {
    id: o.id,
    createdAt: o.created_at,
    customerEmail: o.customer_email,
    productCode: o.payt_product_code,
    productName: o.payt_product_name,
    status: o.status as OrderStatus,
    isTest: o.is_test,
    amountCents: o.amount_cents,
    source: o.source,
  }
}

export async function listOrders(storeId: string, filter: OrderFilter): Promise<AdminOrder[]> {
  const db = createAdminClient()
  let query = db.from('orders').select(ORDER_COLUMNS).order('created_at', { ascending: false }).limit(200)
  query = filter === 'desconhecidas' ? query.is('store_id', null) : query.eq('store_id', storeId)
  if (filter === 'problemas') query = query.in('status', ['reembolsado', 'chargeback'])
  if (filter === 'teste') query = query.eq('is_test', true)
  const { data, error } = await query
  if (error) throw error
  const orders = (data as DbOrder[]).map(toAdminOrder)
  if (filter !== 'desconhecidas' || orders.length === 0) return orders

  const { data: offers, error: offersError } = await db
    .from('offers')
    .select('payt_product_code')
    .in('payt_product_code', [...new Set(orders.map((o) => o.productCode))])
  if (offersError) throw offersError
  const known = new Set(offers.map((o) => o.payt_product_code as string))
  return orders.filter((o) => !known.has(o.productCode))
}

export async function listOrdersByEmail(email: string): Promise<AdminOrder[]> {
  const { data, error } = await createAdminClient()
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('customer_email', email)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as DbOrder[]).map(toAdminOrder)
}
