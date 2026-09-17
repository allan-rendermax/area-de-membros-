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

export type AdminOrder = {
  id: string
  createdAt: string
  customerEmail: string
  productCode: string
  productName: string
  status: OrderStatus
  isTest: boolean
  amountCents: number | null
}

export type OrderFilter = 'todos' | 'problemas' | 'desconhecidas' | 'teste'

const ORDER_COLUMNS = 'id, created_at, customer_email, payt_product_code, payt_product_name, status, is_test, amount_cents'

type DbOrder = {
  id: string
  created_at: string
  customer_email: string
  payt_product_code: string
  payt_product_name: string
  status: string
  is_test: boolean
  amount_cents: number | null
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
  }
}

export async function listOrders(storeId: string, filter: OrderFilter): Promise<AdminOrder[]> {
  const db = createAdminClient()
  let query = db.from('orders').select(ORDER_COLUMNS).eq('store_id', storeId).order('created_at', { ascending: false }).limit(200)
  if (filter === 'problemas') query = query.in('status', ['reembolsado', 'chargeback'])
  if (filter === 'teste') query = query.eq('is_test', true)
  const { data, error } = await query
  if (error) throw error
  const orders = (data as DbOrder[]).map(toAdminOrder)

  if (filter !== 'desconhecidas') return orders
  const { data: offers, error: offersError } = await db.from('offers').select('payt_product_code').eq('store_id', storeId)
  if (offersError) throw offersError
  const known = new Set(offers.map((o) => o.payt_product_code))
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

export async function hasPaidOrderInStore(email: string, storeId: string): Promise<boolean> {
  const db = createAdminClient()
  const { data: orders, error } = await db
    .from('orders')
    .select('payt_product_code')
    .eq('customer_email', email)
    .eq('status', 'pago')
  if (error) throw error
  const codes = [...new Set(orders.map((o) => o.payt_product_code as string))]
  if (codes.length === 0) return false

  const { count, error: offersError } = await db
    .from('offers')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .in('payt_product_code', codes)
  if (offersError) throw offersError
  return (count ?? 0) > 0
}
