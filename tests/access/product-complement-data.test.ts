import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadProductComplement } from '@/lib/data/product-complement'
import type { CustomerRow, Product } from '@/lib/domain/types'

const { getProductById, loadGrantedProductIds } = vi.hoisted(() => ({ getProductById: vi.fn(), loadGrantedProductIds: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ getProductById }))
vi.mock('@/lib/data/access', () => ({ loadGrantedProductIds }))

const source = { id: 'atlas', storeId: 's', complementaryProductId: 'protocol' } as Product
const target = { id: 'protocol', storeId: 's', slug: 'protocol', isPublished: true, checkoutUrl: 'https://example.test/buy' } as Product
const customer = { id: 'customer', email: 'test@example.com', blockedAt: null } as CustomerRow

describe('loadProductComplement', () => {
  beforeEach(() => { vi.resetAllMocks(); getProductById.mockResolvedValue(target); loadGrantedProductIds.mockResolvedValue(new Set()) })
  it('short circuits without association and isolates stores', async () => {
    expect(await loadProductComplement({ ...source, complementaryProductId: null }, 'store', customer, false)).toBeNull()
    expect(getProductById).not.toHaveBeenCalled()
    getProductById.mockResolvedValue({ ...target, storeId: 'other' })
    expect(await loadProductComplement(source, 'store', customer, false)).toBeNull()
    expect(loadGrantedProductIds).not.toHaveBeenCalled()
  })
  it('does not use unpublished target outside authorized preview', async () => {
    getProductById.mockResolvedValue({ ...target, isPublished: false })
    expect(await loadProductComplement(source, 'store', customer, false)).toBeNull()
    expect((await loadProductComplement(source, 'store', null, true))?.href).toBe('/store/produto/protocol?previa=1')
  })
  it.each(['basic', 'complete', 'locked'] as const)('hides drafts and keeps %s preview independent of customer grants', async (preview) => {
    getProductById.mockResolvedValue({ ...target, isPublished: false })
    expect(await loadProductComplement(source, 'store', customer, preview)).toBeNull()
    getProductById.mockResolvedValue(target)
    const complement = await loadProductComplement(source, 'store', customer, preview)
    expect(complement?.owned).toBe(preview !== 'locked')
    expect(loadGrantedProductIds).not.toHaveBeenCalled()
  })
  it('loads actual ownership and propagates access errors', async () => {
    loadGrantedProductIds.mockResolvedValue(new Set(['protocol']))
    expect((await loadProductComplement(source, 'store', customer, false))?.owned).toBe(true)
    loadGrantedProductIds.mockRejectedValue(new Error('orders unavailable'))
    await expect(loadProductComplement(source, 'store', customer, false)).rejects.toThrow('orders unavailable')
  })
})
