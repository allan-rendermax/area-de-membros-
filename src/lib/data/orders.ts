import type { OrderRef, OrderStatus } from '@/lib/domain/types'
import { canRevoke } from '@/lib/admin/manual-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCustomer } from './customers'

export async function listAllOrderRefsByEmail(email: string): Promise<OrderRef[]> {
  const { data, error } = await createAdminClient()
    .from('orders')
    .select('payt_product_code, offer_id, status')
    .eq('customer_email', email)
  if (error) throw error
  return data.map((o) => ({ productCode: o.payt_product_code, offerId: o.offer_id ?? null, status: o.status as OrderStatus }))
}

export type AdminOrder = {
  id: string
  storeId: string | null
  createdAt: string
  customerEmail: string
  productCode: string
  offerId?: string | null
  checkoutUrl?: string | null
  upsellCode?: string | null
  identificationWarning?: string | null
  productName: string
  status: OrderStatus
  isTest: boolean
  amountCents: number | null
  source: string
  note: string
  createdBy: string
}

export type OrderFilter = 'todos' | 'problemas' | 'desconhecidas' | 'teste'

const ORDER_COLUMNS = 'id, store_id, created_at, customer_email, payt_product_code, payt_product_name, status, is_test, amount_cents, source, note, created_by, offer_id, checkout_url, upsell_code, identification_warning'

type DbOrder = {
  id: string
  store_id: string | null
  created_at: string
  customer_email: string
  payt_product_code: string
  offer_id: string | null
  checkout_url: string | null
  upsell_code: string | null
  identification_warning: string | null
  payt_product_name: string
  status: string
  is_test: boolean
  amount_cents: number | null
  source: string
  note: string
  created_by: string
}

function toAdminOrder(o: DbOrder): AdminOrder {
  return {
    id: o.id,
    storeId: o.store_id,
    createdAt: o.created_at,
    customerEmail: o.customer_email,
    productCode: o.payt_product_code,
    offerId: o.offer_id ?? null,
    checkoutUrl: o.checkout_url ?? null,
    upsellCode: o.upsell_code ?? null,
    identificationWarning: o.identification_warning ?? null,
    productName: o.payt_product_name,
    status: o.status as OrderStatus,
    isTest: o.is_test,
    amountCents: o.amount_cents,
    source: o.source,
    note: o.note,
    createdBy: o.created_by,
  }
}

export async function listOrders(storeId: string, filter: OrderFilter): Promise<AdminOrder[]> {
  const db = createAdminClient()
  let query = db.from('orders').select(ORDER_COLUMNS).order('created_at', { ascending: false }).limit(200)
  query = filter === 'desconhecidas' ? query.is('store_id', null) : query.eq('store_id', storeId)
  if (filter === 'problemas') query = query.or('status.in.(reembolsado,chargeback),identification_warning.not.is.null')
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

export async function hasPaidOrderInStore(email: string, storeId: string): Promise<boolean> {
  const db = createAdminClient()
  const { data: orders, error } = await db
    .from('orders')
    .select('payt_product_code, offer_id')
    .eq('customer_email', email)
    .eq('status', 'pago')
  if (error) throw error
  const codes = [...new Set(orders.map((o) => o.payt_product_code as string))]
  if (codes.length === 0) return false

  const { data: offers, error: offersError } = await db
    .from('offers')
    .select('id, payt_product_code, match_type')
    .eq('store_id', storeId)
    .in('payt_product_code', codes)
  if (offersError) throw offersError
  return orders.some((order) => offers.some((offer) => offer.payt_product_code === order.payt_product_code
    && (order.offer_id ? offer.id === order.offer_id : offer.match_type === 'product')))
}

export async function createManualOrder(input: {
  storeId: string
  offerId: string
  customerId: string
  adminEmail: string
  note: string
}): Promise<void> {
  const { error } = await createAdminClient().rpc('create_manual_order_atomic', {
    p_store_id: input.storeId,
    p_offer_id: input.offerId,
    p_customer_id: input.customerId,
    p_admin_email: input.adminEmail,
    p_note: input.note,
  })
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    throw new Error('A liberação manual ainda não está disponível. A migração de integridade precisa ser aplicada.')
  }
  if (error?.code === 'P0001') throw new Error(error.message)
  if (error) throw new Error('Não foi possível confirmar a liberação. Recarregue a ficha antes de tentar novamente.')
}

export async function revokeManualOrder(input: { orderId: string; storeId: string; customerId: string }): Promise<void> {
  const customer = await getCustomer(input.customerId)
  if (!customer) throw new Error('Cliente não encontrado.')
  const db = createAdminClient()
  const { data: order, error } = await db.from('orders')
    .select('source, status')
    .eq('id', input.orderId)
    .eq('store_id', input.storeId)
    .eq('customer_email', customer.email)
    .maybeSingle()
  if (error) throw error
  if (!order || !canRevoke(order)) throw new Error('Só é possível remover um pedido manual pago deste cliente na loja atual.')

  // Repete as condições na escrita para proteger contra mudanças simultâneas.
  const { data, error: updateError } = await db.from('orders')
    .update({ status: 'cancelado', status_rank: 2 })
    .eq('id', input.orderId)
    .eq('store_id', input.storeId)
    .eq('customer_email', customer.email)
    .eq('source', 'manual')
    .eq('status', 'pago')
    .select('id')
  if (updateError) throw updateError
  if (!data.length) throw new Error('O pedido mudou. Recarregue a ficha do cliente.')
}
