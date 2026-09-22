import { describe, expect, it } from 'vitest'
import { buildShelf, grantedProductIds } from '@/lib/access/access'
import type { Product, ProductLink } from '@/lib/domain/types'

const links: ProductLink[] = [
  { productCode: 'BASICO', productId: 'atlas' },
  { productCode: 'COMPLETO', productId: 'atlas' },
  { productCode: 'COMPLETO', productId: 'bonus1' },
  { productCode: 'BUMP', productId: 'checklist' },
]

function product(id: string, sortOrder: number, extra: Partial<Product> = {}): Product {
  return {
    id, storeId: 's1', slug: id, title: id, track: '', description: `sobre ${id}`,
    coverUrl: null, bannerUrl: null, checkoutUrl: `https://payt/${id}`,
    isFeatured: false, sortOrder, isPublished: true, ...extra,
  }
}

describe('grantedProductIds', () => {
  it('libera os produtos das ofertas pagas', () => {
    const ids = grantedProductIds([{ productCode: 'COMPLETO', status: 'pago' }], links, false)
    expect([...ids].sort()).toEqual(['atlas', 'bonus1'])
  })

  it('reembolso de uma oferta mantém produto liberado por outra', () => {
    const ids = grantedProductIds(
      [{ productCode: 'BASICO', status: 'reembolsado' }, { productCode: 'COMPLETO', status: 'pago' }],
      links,
      false,
    )
    expect(ids.has('atlas')).toBe(true)
  })

  it('bump reembolsado com plano mantido remove só o bump', () => {
    const ids = grantedProductIds(
      [{ productCode: 'BASICO', status: 'pago' }, { productCode: 'BUMP', status: 'reembolsado' }],
      links,
      false,
    )
    expect([...ids]).toEqual(['atlas'])
  })

  it('código cadastrado depois passa a liberar', () => {
    const orders = [{ productCode: 'NOVO', status: 'pago' as const }]
    expect(grantedProductIds(orders, links, false).size).toBe(0)
    expect([...grantedProductIds(orders, [...links, { productCode: 'NOVO', productId: 'pack' }], false)]).toEqual(['pack'])
  })

  it('cliente bloqueado não tem acesso', () => {
    expect(grantedProductIds([{ productCode: 'COMPLETO', status: 'pago' }], links, true).size).toBe(0)
  })
})

describe('buildShelf', () => {
  const products = [
    product('bonus1', 2),
    product('atlas', 1),
    product('oculto', 0, { isPublished: false }),
    product('pack', 3, { isFeatured: true }),
  ]

  it('separa liberados e bloqueados em ordem e esconde não publicados', () => {
    const shelf = buildShelf(products, new Set(['atlas']))
    expect(shelf.unlocked.map((p) => p.id)).toEqual(['atlas'])
    expect(shelf.locked.map((p) => p.id)).toEqual(['bonus1', 'pack'])
  })

  it('usa o produto em destaque no topo', () => {
    expect(buildShelf(products, new Set(['atlas'])).featured?.id).toBe('pack')
  })

  it('sem destaque usa o primeiro liberado, depois o primeiro bloqueado', () => {
    const plain = products.map((p) => ({ ...p, isFeatured: false }))
    expect(buildShelf(plain, new Set(['bonus1'])).featured?.id).toBe('bonus1')
    expect(buildShelf(plain, new Set()).featured?.id).toBe('atlas')
    expect(buildShelf([], new Set()).featured).toBeNull()
  })

  it('só expõe checkout de produto bloqueado', () => {
    const shelf = buildShelf(products, new Set(['atlas']))
    expect(shelf.unlocked[0].checkoutUrl).toBeNull()
    expect(shelf.locked[0].checkoutUrl).toBe('https://payt/bonus1')
  })
})
