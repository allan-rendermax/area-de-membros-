import { describe, expect, it } from 'vitest'
import { parsePaytPostback } from '@/lib/payt/parse'
import bumps from '../fixtures/payt-paid-bumps.json'
import paid from '../fixtures/payt-paid.json'

describe('parsePaytPostback', () => {
  it('extrai os campos usados pelo sistema', () => {
    expect(parsePaytPostback(paid)).toEqual({
      ok: true,
      value: {
        transactionId: 'TX123',
        status: 'paid',
        type: 'order',
        isTest: false,
        customerEmail: 'joao@gmail.com',
        customerName: 'João Silva',
        products: [{ code: 'ATLAS-COMPLETO', name: 'Atlas Visual - Plano Completo', amountCents: 4700 }],
      },
    })
  })

  it('usa o sku quando não há code e aceita ids numéricos', () => {
    const result = parsePaytPostback({ ...paid, transaction_id: 987, product: { name: 'X', sku: 555 } })
    expect(result.ok && result.value.products[0].code).toBe('555')
    expect(result.ok && result.value.transactionId).toBe('987')
  })

  it('entende test como texto', () => {
    const result = parsePaytPostback({ ...paid, test: 'true' })
    expect(result.ok && result.value.isTest).toBe(true)
  })

  it('falha sem email válido', () => {
    expect(parsePaytPostback({ ...paid, customer: { name: 'X', email: 'sem-email' } }).ok).toBe(false)
  })

  it('falha sem código de produto', () => {
    expect(parsePaytPostback({ ...paid, product: { name: 'X' } })).toEqual({ ok: false, error: 'produto sem code/sku' })
  })

  it('inclui bumps de product.items e order_bumps sem repetir códigos', () => {
    const result = parsePaytPostback(bumps)
    expect(result.ok && result.value.products).toEqual([
      { code: 'ATLAS-COMPLETO', name: 'Atlas Visual - Plano Completo', amountCents: 4700 },
      { code: 'BUMP-CHECKLIST', name: 'Checklist de Vistoria', amountCents: 1700 },
      { code: 'BUMP-PACK', name: 'Pack de Detalhes', amountCents: 1900 },
    ])
  })

  it('ignora bump sem código ou fora do formato', () => {
    const result = parsePaytPostback({ ...paid, order_bumps: [{ name: 'Sem código', price: 900 }, 'lixo', null] })
    expect(result.ok && result.value.products.map((p) => p.code)).toEqual(['ATLAS-COMPLETO'])
  })

  it('aceita order_bumps que não é lista', () => {
    const result = parsePaytPostback({ ...paid, order_bumps: 'nenhum' })
    expect(result.ok && result.value.products).toHaveLength(1)
  })
})
