import { describe, expect, it } from 'vitest'
import { buildManualOrder, canRevoke } from '@/lib/admin/manual-access'

describe('buildManualOrder', () => {
  const input = {
    storeId: 'loja-1',
    offer: { name: 'Pacote completo', paytProductCode: 'PACOTE-01' },
    customer: { email: 'aluno@example.com' },
    adminEmail: 'admin@example.com',
    note: 'Acesso de cortesia',
    transactionId: 'MANUAL-00000000-0000-4000-8000-000000000001',
    now: '2026-09-22T12:00:00.000Z',
  }

  it('monta exatamente a linha do pedido manual com auditoria', () => {
    expect(buildManualOrder(input)).toEqual({
      store_id: 'loja-1',
      payt_transaction_id: input.transactionId,
      payt_product_code: 'PACOTE-01',
      payt_product_name: 'Pacote completo',
      customer_email: 'aluno@example.com',
      status: 'pago',
      status_rank: 1,
      source: 'manual',
      is_test: false,
      paid_at: '2026-09-22T12:00:00.000Z',
      amount_cents: 0,
      note: 'Acesso de cortesia',
      created_by: 'admin@example.com',
    })
  })

  it('aceita motivo vazio preservando quem liberou', () => {
    const order = buildManualOrder({ ...input, note: '' })
    expect(order.note).toBe('')
    expect(order.created_by).toBe(input.adminEmail)
  })
})

describe('canRevoke', () => {
  it.each(['manual', 'payt', 'importado'])('valida todos os status da origem %s', (source) => {
    for (const status of ['pendente', 'pago', 'cancelado', 'reembolsado', 'chargeback']) {
      expect(canRevoke({ source, status })).toBe(source === 'manual' && status === 'pago')
    }
  })
})
