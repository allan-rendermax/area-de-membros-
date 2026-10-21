import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { describe, expect, it, vi } from 'vitest'
import { renderItemContent } from '@/components/membros/item-content'
import type { AccessLevel, Item, ModuleWithItems, Product, Store } from '@/lib/domain/types'

vi.mock('@/app/[loja]/progresso/actions', () => ({ saveCompletion: vi.fn() }))
vi.mock('@/lib/data/member-progress', () => ({ listCompletedItemIds: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/data/item-access', () => ({ recordItemAccess: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ listModulesWithItems: vi.fn() }))
vi.mock('@/lib/data/product-complement', () => ({ loadProductComplement: vi.fn().mockResolvedValue({ product: { id: 'protocol', title: 'Protocolo Anti-Retrabalho', description: 'Conheça o protocolo' }, owned: false, href: 'https://example.test/buy', external: true }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/arquitetura', useSearchParams: () => new URLSearchParams() }))

const store = { id: 'store', slug: 'arquitetura', name: 'Arquitetura', logoUrl: null, supportUrl: null, supportWhatsapp: null, loginImageUrl: null } as Store
const product = { id: 'atlas', storeId: 'store', slug: 'atlas', title: 'Atlas', track: 'Patologias', description: '', contentMode: 'versions', isPublished: true, complementaryProductId: 'protocol' } as Product
const basic = { id: 'basic', moduleId: 'basic-module', title: 'Básico', kind: 'arquivo', url: 'https://example.test/basic.pdf', isPublished: true } as Item
const complete = { ...basic, id: 'complete', moduleId: 'complete-module', title: 'Completo' }
const modules = [
  { id: 'basic-module', productId: 'atlas', title: 'Básico', requiredLevel: 'basic', isPublished: true, items: [basic] },
  { id: 'complete-module', productId: 'atlas', title: 'Completo', requiredLevel: 'complete', isPublished: true, items: [complete] },
] as ModuleWithItems[]

describe('item content complement', () => {
  it.each(['basic', 'complete'] as const)('keeps complement separate from %s materials and progress', async (level: AccessLevel) => {
    const index = level === 'basic' ? 0 : 1
    const tree = await renderItemContent({ ctx: { product, module: modules[index], item: modules[index].items[0] }, store, customer: { id: 'c', email: 'c@example.test', name: 'C', blockedAt: null }, level, preview: false, blocked: false, productModules: modules })
    const window = new Window()
    window.document.body.innerHTML = renderToStaticMarkup(tree)
    const document = window.document
    expect(document.querySelectorAll('section[aria-label="Produto complementar"]')).toHaveLength(2)
    expect(document.querySelector('section[aria-label="Produto complementar"] a')?.getAttribute('href')).toBe('https://example.test/buy')
    expect(document.querySelectorAll('details.lesson-module')).toHaveLength(1)
    expect(document.querySelector('details.lesson-module')?.textContent).toContain(level === 'basic' ? 'Básico' : 'Completo')
    expect(document.querySelector('details.lesson-module')?.textContent).not.toContain('Protocolo')
  })
})
