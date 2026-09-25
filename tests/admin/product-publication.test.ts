import { beforeEach, describe, expect, it, vi } from 'vitest'
const io = vi.hoisted(() => ({ product: vi.fn(), modules: vi.fn(), offers: vi.fn(), offer: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ getProductById: io.product, listModulesWithItems: io.modules }))
vi.mock('@/lib/data/products-admin', () => ({ listOffers: io.offers, getOffer: io.offer }))
import { assertProductPublicationReady, assertOfferProductsReady } from '@/lib/admin/product-publication'
beforeEach(() => {
  vi.resetAllMocks()
  io.product.mockResolvedValue({ id: 'p', storeId: 's', title: 'Atlas', isPublished: false, contentMode: 'versions' })
  io.modules.mockResolvedValue([{ isPublished: true, requiredLevel: 'basic', items: [{ isPublished: true, kind: 'arquivo', url: 'https://example.com/a.pdf' }] }])
  io.offers.mockResolvedValue([{ productIds: ['p'], productLevels: { p: 'complete' } }])
  io.offer.mockResolvedValue(null)
})
describe('publication readiness', () => {
  it('allows saving a draft without content', async () => {
    await assertProductPublicationReady({ storeId: 's', isPublished: false, mode: 'versions' })
    expect(io.modules).not.toHaveBeenCalled()
  })
  it('rejects publishing an empty new product', async () => {
    await expect(assertProductPublicationReady({ storeId: 's', isPublished: true })).rejects.toThrow(/rascunho/)
  })
  it('blocks a promised Complete version with only Basic resources', async () => {
    await expect(assertProductPublicationReady({ productId: 'p', storeId: 's', isPublished: true, mode: 'versions' })).rejects.toThrow(/Completo/)
  })
  it('preserves legacy publication while blocking conversion with empty Complete', async () => {
    io.product.mockResolvedValue({ id: 'p', storeId: 's', isPublished: true, contentMode: 'sections' })
    await assertProductPublicationReady({ productId: 'p', storeId: 's', isPublished: true, mode: 'sections' })
    await expect(assertProductPublicationReady({ productId: 'p', storeId: 's', isPublished: true, mode: 'versions' })).rejects.toThrow(/Completo/)
  })
  it('rejects new offer bindings to an empty level but permits unchanged legacy offer edits', async () => {
    io.product.mockResolvedValue({ id: 'p', storeId: 's', title: 'Atlas', isPublished: true, contentMode: 'versions' })
    const offer = { id: null, storeId: 's', name: 'Oferta', paytProductCode: 'code', productIds: ['p'], productLevels: { p: 'complete' as const } }
    await expect(assertOfferProductsReady(offer)).rejects.toThrow(/Completo/)
    io.offer.mockResolvedValue(offer)
    await assertOfferProductsReady({ ...offer, id: 'old' })
  })
  it('does not sell a draft product with published resources', async () => {
    await expect(assertOfferProductsReady({ id: null, storeId: 's', name: 'Oferta', paytProductCode: 'code', productIds: ['p'], productLevels: { p: 'basic' } })).rejects.toThrow(/publique o produto/)
  })
  it('rejects another store before checking materials', async () => {
    io.product.mockResolvedValue({ id: 'p', storeId: 'other' })
    await expect(assertProductPublicationReady({ productId: 'p', storeId: 's', isPublished: true })).rejects.toThrow(/loja/)
    expect(io.modules).not.toHaveBeenCalled()
  })
})
