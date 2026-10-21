import { describe, expect, it } from 'vitest'
import { resolveProductComplement } from '@/lib/access/product-complement'
import { findRequestedComplement } from '@/lib/access/product-complement'
import type { Product } from '@/lib/domain/types'

const atlas = { id: 'atlas', storeId: 'store', slug: 'atlas', title: 'Atlas', isPublished: true, complementaryProductId: 'protocol' } as Product
const protocol = { id: 'protocol', storeId: 'store', slug: 'protocolo-anti-retrabalho', title: 'Protocolo Anti-Retrabalho', isPublished: true, checkoutUrl: 'https://example.test/full', studentCheckoutUrl: 'https://example.test/student' } as Product

describe('resolveProductComplement', () => {
  it('uses material route for owners and preview', () => {
    expect(resolveProductComplement(atlas, [protocol], new Set(['protocol']), 'arquitetura')).toMatchObject({ owned: true, href: '/arquitetura/produto/protocolo-anti-retrabalho', external: false })
    expect(resolveProductComplement(atlas, [protocol], new Set(), 'arquitetura', true)?.href).toBe('/arquitetura/produto/protocolo-anti-retrabalho?previa=1')
  })
  it.each(['basic', 'complete'] as const)('preserves %s simulation links and hides draft complements', (preview) => {
    expect(resolveProductComplement(atlas, [protocol], new Set(), 'arquitetura', preview)).toMatchObject({ owned: true, external: false, href: '/arquitetura/produto/protocolo-anti-retrabalho?previa=1&simular=' + preview })
    expect(resolveProductComplement(atlas, [{ ...protocol, isPublished: false }], new Set(), 'arquitetura', preview)).toBeNull()
  })
  it('keeps locked simulation on checkout and draft access editorial-only', () => {
    expect(resolveProductComplement(atlas, [protocol], new Set(['protocol']), 'arquitetura', 'locked')).toMatchObject({ owned: false, external: true, href: protocol.studentCheckoutUrl })
    const draft = { ...protocol, isPublished: false }
    expect(resolveProductComplement(atlas, [draft], new Set(), 'arquitetura', 'locked')).toBeNull()
    expect(resolveProductComplement(atlas, [draft], new Set(), 'arquitetura', 'editorial')).toMatchObject({ owned: true, href: '/arquitetura/produto/protocolo-anti-retrabalho?previa=1' })
  })
  it('uses safe student checkout then safe regular checkout', () => {
    expect(resolveProductComplement(atlas, [protocol], new Set(['atlas']), 'arquitetura')?.href).toBe(protocol.studentCheckoutUrl)
    expect(resolveProductComplement(atlas, [{ ...protocol, studentCheckoutUrl: 'javascript:bad' }], new Set(), 'arquitetura')?.href).toBe(protocol.checkoutUrl)
    expect(resolveProductComplement(atlas, [{ ...protocol, studentCheckoutUrl: 'javascript:bad', checkoutUrl: 'data:bad' }], new Set(), 'arquitetura')?.href).toBeNull()
  })
  it('ignores invalid targets', () => {
    expect(resolveProductComplement(atlas, [{ ...protocol, storeId: 'other' }], new Set(), 'arquitetura')).toBeNull()
    expect(resolveProductComplement(atlas, [{ ...protocol, isPublished: false }], new Set(), 'arquitetura')).toBeNull()
    expect(resolveProductComplement(atlas, [], new Set(), 'arquitetura')).toBeNull()
    expect(resolveProductComplement({ ...atlas, complementaryProductId: atlas.id }, [{ ...protocol, id: atlas.id }], new Set(), 'arquitetura')).toBeNull()
  })
})

describe('complement purchase deep link', () => {
  const covers = [{ id: 'protocol', slug: 'protocol', unlocked: false }, { id: 'atlas', slug: 'atlas', unlocked: true }] as import('@/lib/access/access').ShelfProduct[]
  it('selects only a locked linked target requested by comprar', () => {
    expect(findRequestedComplement(covers, new Set(['protocol']), 'protocol')?.id).toBe('protocol')
    expect(findRequestedComplement(covers, new Set(['protocol']), 'atlas')).toBeNull()
    expect(findRequestedComplement(covers, new Set(['atlas']), 'protocol')).toBeNull()
    expect(findRequestedComplement(covers, new Set(['protocol']), null)).toBeNull()
  })
})
