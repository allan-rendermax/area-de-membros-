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

  it.each(['', '  '])('usa sku quando o code principal é vazio (%j)', (code) => {
    const result = parsePaytPostback({ ...paid, product: { code, sku: ' SKU-1 ' } })
    expect(result.ok && result.value.products[0].code).toBe('SKU-1')
  })

  it.each(['items', 'order_bumps'])('usa sku e id quando code do bump é vazio em %s', (source) => {
    const lines = [{ code: '  ', sku: ' B2 ' }, { code: '', id: 77 }]
    const result = parsePaytPostback({
      ...paid,
      product: { ...paid.product, ...(source === 'items' ? { items: lines } : {}) },
      ...(source === 'order_bumps' ? { order_bumps: lines } : {}),
    })
    expect(result.ok && result.value.products.map((p) => p.code)).toEqual(['ATLAS-COMPLETO', 'B2', '77'])
  })

  it('preserva a prioridade code, sku, id e ignora identificadores vazios', () => {
    const result = parsePaytPostback({
      ...paid, product: { code: ' MAIN ', sku: 'OTHER' },
      order_bumps: [{ code: ' B1 ', sku: 'B2', id: 77 }, { code: ' ', sku: ' ', id: 0 }, { code: '', sku: ' ' }],
    })
    expect(result.ok && result.value.products.map((p) => p.code)).toEqual(['MAIN', 'B1', '0'])
  })

  it('mantém o erro quando code e sku principais estão vazios', () => {
    expect(parsePaytPostback({ ...paid, product: { code: ' ', sku: '' } })).toEqual({ ok: false, error: 'produto sem code/sku' })
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
