type ManualOrderInput = {
  storeId: string
  offer: { name: string; paytProductCode: string }
  customer: { email: string }
  adminEmail: string
  note: string
  transactionId: string
  now: string
}

export function buildManualOrder(input: ManualOrderInput) {
  return {
    store_id: input.storeId,
    payt_transaction_id: input.transactionId,
    payt_product_code: input.offer.paytProductCode,
    payt_product_name: input.offer.name,
    customer_email: input.customer.email,
    status: 'pago',
    status_rank: 1,
    source: 'manual',
    is_test: false,
    paid_at: input.now,
    amount_cents: 0,
    note: input.note,
    created_by: input.adminEmail,
  }
}

export function canRevoke(order: { source: string; status: string }): boolean {
  return order.source === 'manual' && order.status === 'pago'
}
