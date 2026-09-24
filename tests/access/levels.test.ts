import { describe, expect, it } from 'vitest'
import { canAccessLevel, grantedProductIds, grantedProductLevels } from '@/lib/access/access'
import type { OrderRef, ProductLink } from '@/lib/domain/types'

const links: ProductLink[] = [
  { productCode: 'B', productId: 'P', grantLevel: 'basic' },
  { productCode: 'C', productId: 'P', grantLevel: 'complete' },
  { productCode: 'LEGACY', productId: 'L' },
]

describe('product levels', () => {
  it('grants basic for a paid basic offer and complete includes basic', () => {
    expect(grantedProductLevels([{ productCode: 'B', status: 'pago' }], links, false).get('P')).toBe('basic')
    expect(canAccessLevel('basic', 'complete')).toBe(false)
    expect(canAccessLevel('complete', 'basic')).toBe(true)
    expect(canAccessLevel('basic')).toBe(true)
    expect(canAccessLevel(undefined)).toBe(false)
  })

  it('takes the greatest level across paid orders and falls back after refund', () => {
    const paid: OrderRef[] = [{ productCode: 'B', status: 'pago' }, { productCode: 'C', status: 'pago' }]
    expect(grantedProductLevels(paid, links, false).get('P')).toBe('complete')
    expect(grantedProductLevels([{ ...paid[0] }, { productCode: 'C', status: 'reembolsado' }], links, false).get('P')).toBe('basic')
    expect(grantedProductLevels([{ ...paid[0] }, { productCode: 'C', status: 'chargeback' }], links, false).get('P')).toBe('basic')
    expect(grantedProductLevels([{ ...paid[0] }, { productCode: 'C', status: 'cancelado' }], links, false).get('P')).toBe('basic')
  })

  it('keeps a grant while another order with the same code is paid', () => {
    expect(grantedProductLevels([{ productCode: 'C', status: 'reembolsado' }, { productCode: 'C', status: 'pago' }], links, false).get('P')).toBe('complete')
  })

  it('treats legacy links as complete and preserves ids wrapper', () => {
    const orders: OrderRef[] = [{ productCode: 'LEGACY', status: 'pago' }]
    expect(grantedProductLevels(orders, links, false).get('L')).toBe('complete')
    expect(grantedProductIds(orders, links, false)).toEqual(new Set(['L']))
  })

  it('denies every level when blocked', () => {
    expect(grantedProductLevels([{ productCode: 'C', status: 'pago' }], links, true).size).toBe(0)
  })
})
