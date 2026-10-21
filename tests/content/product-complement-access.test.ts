import { describe, expect, it } from 'vitest'
import { grantedProductLevels } from '@/lib/access/access'
import { resolveProductComplement } from '@/lib/access/product-complement'
import type { Product } from '@/lib/domain/types'

const source = { id: 'atlas', storeId: 's', complementaryProductId: 'protocol' } as Product
const target = { id: 'protocol', storeId: 's', slug: 'protocol', isPublished: true, checkoutUrl: 'https://example.test/buy' } as Product
const links = [{ productCode: 'atlas-code', productId: 'atlas' }, { productCode: 'protocol-code', productId: 'protocol' }]

describe('complement ownership from existing orders', () => {
  it('does not infer access from the source, pending or refunded orders', () => {
    const levels = grantedProductLevels([{ productCode: 'atlas-code', status: 'pago' }, { productCode: 'protocol-code', status: 'pendente' }, { productCode: 'protocol-code', status: 'reembolsado' }], links, false)
    expect(resolveProductComplement(source, [target], new Set(levels.keys()), 'loja')?.owned).toBe(false)
  })
  it('keeps access when another paid order exists', () => {
    const levels = grantedProductLevels([{ productCode: 'protocol-code', status: 'reembolsado' }, { productCode: 'protocol-code', status: 'pago' }], links, false)
    expect(resolveProductComplement(source, [target], new Set(levels.keys()), 'loja')?.owned).toBe(true)
  })
})
