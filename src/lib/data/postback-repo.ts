import { STATUS_RANK, type OrderStatus } from '@/lib/domain/types'
import type { PostbackRepo } from '@/lib/orders/process-postback'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCustomer, findCustomerByEmail } from './customers'
import { findStoreForProductCode, getProductsForCode } from './products'

export function createPostbackRepo(): PostbackRepo {
  const db = createAdminClient()

  return {
    async logEvent(payload) {
      const { data, error } = await db.from('payt_events').insert({ payload }).select('id').single()
      if (error) throw error
      return data.id
    },

    async finishEvent(id, result) {
      const { error } = await db
        .from('payt_events')
        .update({
          key_valid: result.keyValid,
          outcome: result.outcome,
          error: result.error ?? null,
          customer_email: result.customerEmail ?? null,
          product_codes: result.productCodes ?? [],
          payt_status: result.paytStatus ?? null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },

    findStoreForProductCode,

    async applyOrderStatus(input) {
      const { data, error } = await db
        .rpc('apply_order_status', {
          p_store_id: input.storeId,
          p_transaction_id: input.transactionId,
          p_product_code: input.productCode,
          p_product_name: input.productName,
          p_customer_email: input.customerEmail,
          p_customer_name: input.customerName,
          p_status: input.status,
          p_status_rank: STATUS_RANK[input.status],
          p_payt_type: input.paytType,
          p_is_test: input.isTest,
          p_amount_cents: input.amountCents,
        })
        .single()
      if (error) throw error
      const row = data as { out_order_id: string; out_changed: boolean; out_status: OrderStatus }
      const { data: persisted, error: readError } = await db
        .from('orders')
        .select('id, customer_email, customer_name, status')
        .eq('id', row.out_order_id)
        .single()
      if (readError) throw readError
      if (!persisted) throw new Error(`Pedido ${row.out_order_id} não encontrado após atualização`)
      return {
        orderId: persisted.id,
        changed: row.out_changed,
        status: persisted.status as OrderStatus,
        customerEmail: persisted.customer_email,
        customerName: persisted.customer_name,
      }
    },

    findCustomerByEmail,
    createCustomer,
    getProductsForCode,

    async hasNoticeForProducts(customerId, storeId, productIds) {
      if (productIds.length === 0) return false
      for (const productId of productIds) {
        const { data, error } = await db
          .from('email_log')
          .select('id')
          .eq('customer_id', customerId)
          .eq('store_id', storeId)
          .contains('product_ids', [productId])
          .limit(1)
        if (error) throw error
        if (!data || data.length === 0) return false
      }
      return true
    },

    async logFailedNotice(entry) {
      const { error } = await db.from('email_log').insert({
        store_id: entry.storeId,
        customer_id: entry.customerId,
        to_email: entry.toEmail,
        kind: entry.kind,
        product_ids: entry.productIds,
        status: 'falhou',
        error: entry.error,
      })
      if (error) throw error
    },
  }
}
