import { STATUS_RANK, type OrderStatus } from '@/lib/domain/types'
import type { PostbackRepo } from '@/lib/orders/process-postback'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCustomer, findCustomerByEmail } from './customers'
import { getMaterialTitlesForProduct } from './orders'
import { getStoreBySlug } from './stores'

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
          processed_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },

    getStoreBySlug,

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
      return { orderId: row.out_order_id, changed: row.out_changed, status: row.out_status }
    },

    findCustomerByEmail,
    createCustomer,
    getMaterialTitlesForProduct,
  }
}
