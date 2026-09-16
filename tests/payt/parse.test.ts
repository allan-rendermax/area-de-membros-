import { describe, expect, it } from 'vitest'
import { parsePaytPostback } from '@/lib/payt/parse'
import paid from '../fixtures/payt-paid.json'

describe('parsePaytPostback', () => {
  it('extrai os campos usados pelo sistema', () => {
    const result = parsePaytPostback(paid)
    expect(result).toEqual({
      ok: true,
      value: {
        transactionId: 'TX123',
        status: 'paid',
        type: 'order',
        isTest: false,
        customerEmail: 'joao@gmail.com',
        customerName: 'João Silva',
        productCode: 'ATLAS-COMPLETO',
        productName: 'Atlas Visual - Plano Completo',
        amountCents: 4700,
      },
    })
  })

  it('usa o sku quando não há code e aceita ids numéricos', () => {
    const body = { ...paid, transaction_id: 987, product: { name: 'X', sku: 555 } }
    const result = parsePaytPostback(body)
    expect(result.ok && result.value.productCode).toBe('555')
    expect(result.ok && result.value.transactionId).toBe('987')
  })

  it('entende test como texto', () => {
    const result = parsePaytPostback({ ...paid, test: 'true' })
    expect(result.ok && result.value.isTest).toBe(true)
  })

  it('falha sem email válido', () => {
    const result = parsePaytPostback({ ...paid, customer: { name: 'X', email: 'sem-email' } })
    expect(result.ok).toBe(false)
  })

  it('falha sem código de produto', () => {
    const result = parsePaytPostback({ ...paid, product: { name: 'X' } })
    expect(result).toEqual({ ok: false, error: 'produto sem code/sku' })
  })
})
