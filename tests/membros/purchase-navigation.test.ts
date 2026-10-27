import { describe, expect, it } from 'vitest'
import { buildPurchaseNavigation } from '@/lib/membros/purchase-navigation'
import { product, relation } from '../fixtures/contextual-products'

const input = () => ({ storeId: 's1', products: [product('atlas'), product('guia'), product('extra')], relations: [relation('atlas', 'guia'), relation('atlas', 'extra')], granted: new Set(['atlas', 'guia']) })
describe('buildPurchaseNavigation', () => {
  it('keeps acquired siblings and marks only the current product', () => {
    const data = input(); data.granted.add('extra')
    const nav = buildPurchaseNavigation(data, 'guia', 'arquitetura')!
    expect(nav.products.map(p => [p.id, p.current, p.role])).toEqual([['atlas', false, 'principal'], ['extra', false, 'complemento'], ['guia', true, 'complemento']])
    expect(nav.backParent).toEqual({ title: 'atlas', href: '/arquitetura/produto/atlas' })
    expect(buildPurchaseNavigation(data, 'atlas', 'arquitetura')?.backParent).toBeNull()
  })
  it('excludes unowned current products and standalone purchases', () => {
    expect(buildPurchaseNavigation(input(), 'extra', 'arquitetura')).toBeNull()
    expect(buildPurchaseNavigation({ ...input(), granted: new Set(['guia']) }, 'guia', 'arquitetura')).toBeNull()
    expect(buildPurchaseNavigation({ ...input(), relations: [] }, 'guia', 'arquitetura')).toBeNull()
    expect(buildPurchaseNavigation(input(), 'missing', 'arquitetura')).toBeNull()
  })
  it('excludes unpublished and foreign products and relations', () => {
    for (const patch of [{ isPublished: false }, { storeId: 's2' }]) {
      expect(buildPurchaseNavigation({ ...input(), products: [product('atlas'), product('guia', patch)] }, 'guia', 'arquitetura')).toBeNull()
    }
    expect(buildPurchaseNavigation({ ...input(), relations: [{ ...relation('atlas', 'guia'), storeId: 's2' }] }, 'guia', 'arquitetura')).toBeNull()
  })
  it('uses deterministic shared parent selection and deduplicates relations', () => {
    const data = { ...input(), products: [product('z'), product('atlas'), product('guia')], relations: [relation('z', 'guia'), relation('atlas', 'guia'), relation('atlas', 'guia')], granted: new Set(['z', 'atlas', 'guia']) }
    expect(buildPurchaseNavigation(data, 'guia', 'arquitetura')?.products.map(p => p.id)).toEqual(['atlas', 'guia'])
    expect(buildPurchaseNavigation(data, 'z', 'arquitetura')).toBeNull()
  })
  it('honors explicit draft input and encodes preview links without changing source', () => {
    const data = { ...input(), products: [product('atlas', { slug: 'atlas / um' }), product('guia', { isPublished: false })], includeDrafts: true }
    const before = JSON.stringify({ ...data, granted: [...data.granted] })
    const nav = buildPurchaseNavigation(data, 'guia', 'loja / teste', 'basic', 'all')!
    expect(nav.products[0].href).toBe('/loja%20%2F%20teste/produto/atlas%20%2F%20um?previa=1&simular=basic&complementos=all')
    expect(nav.backParent?.href).toBe(nav.products[0].href)
    expect(buildPurchaseNavigation(data, 'atlas', 'loja', 'editorial', 'one')?.products[1].href).toBe('/loja/produto/guia?previa=1&complementos=one')
    expect(JSON.stringify({ ...data, granted: [...data.granted] })).toBe(before)
  })
})
