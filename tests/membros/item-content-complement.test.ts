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
const product = { id: 'atlas', storeId: 'store', slug: 'atlas-visual-das-patologias-na-construcao-civil-completo', title: 'Atlas', track: 'Patologias', description: '', contentMode: 'versions', isPublished: true, complementaryProductId: 'protocol' } as Product
const basic = { id: 'basic', moduleId: 'basic-module', title: 'Básico', kind: 'arquivo', url: 'https://example.test/basic.pdf', isPublished: true } as Item
const complete = { ...basic, id: 'complete', moduleId: 'complete-module', title: 'Completo' }
const modules = [
  { id: 'basic-module', productId: 'atlas', title: 'Básico', requiredLevel: 'basic', isPublished: true, items: [basic] },
  { id: 'complete-module', productId: 'atlas', title: 'Completo', requiredLevel: 'complete', isPublished: true, items: [complete] },
] as ModuleWithItems[]

describe('item content complement', () => {
  it('keeps the complement scenario in sidebar, toolbar, resource and refresh destinations', async () => {
    const second = { ...basic, id: 'second', title: 'Segundo material' }
    const expanded = [{ ...modules[0], items: [basic, second] }, modules[1]]
    const tree = await renderItemContent({ ctx: { product, module: expanded[0], item: basic }, store, customer: null, level: 'basic', preview: 'basic', complementScenario: 'one', blocked: false, productModules: expanded })
    const window = new Window()
    window.document.body.innerHTML = renderToStaticMarkup(tree)
    const links = [...window.document.querySelectorAll('a[href*="/item/"]')]
    expect(links.length).toBeGreaterThanOrEqual(4)
    for (const link of links) expect(new URL(link.getAttribute('href')!, 'https://example.test').searchParams.get('complementos')).toBe('one')
  })
  it.each(['basic', 'complete'] as const)('restores the historical Atlas offer separate from authorized %s materials and progress', async (level: AccessLevel) => {
    const index = level === 'basic' ? 0 : 1
    const tree = await renderItemContent({ ctx: { product, module: modules[index], item: modules[index].items[0] }, store, customer: { id: 'c', email: 'c@example.test', name: 'C', blockedAt: null }, level, preview: false, blocked: false, productModules: modules })
    const window = new Window()
    window.document.body.innerHTML = renderToStaticMarkup(tree)
    const document = window.document
    expect(document.querySelectorAll('section[aria-label="Produto complementar"]')).toHaveLength(0)
    const offer = document.querySelector('section[aria-labelledby="protocolo-upsell-title"]')
    expect(offer?.textContent).toContain('Você deixou isso passar no checkout.')
    expect(offer?.querySelector('a')?.getAttribute('href')).toBe('https://checkout.payt.com.br/f2b5337a076c0be3ccd09fdcfc651601')
    expect(offer?.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(document.querySelector('aside > details.lesson-contents.lesson-sidebar-panel')).not.toBeNull()
    expect(document.querySelectorAll('details.lesson-module')).toHaveLength(1)
    expect(document.querySelector('details.lesson-module')?.textContent).toContain(level === 'basic' ? 'Básico' : 'Completo')
    expect(document.querySelector('details.lesson-module')?.textContent).not.toContain('Protocolo')
  })
})
