import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommunityWhatsapp } from '@/components/membros/community-whatsapp'
import { renderItemContent } from '@/components/membros/item-content'
import ProdutoPage from '@/app/[loja]/produto/[slug]/page'
import { requireStoreSession } from '@/lib/membros/session'
import { getProductBySlug, listModulesWithItems } from '@/lib/data/products'
import { loadGrantedProductLevels } from '@/lib/data/access'
import type { Item, ModuleWithItems, Product, Store } from '@/lib/domain/types'

vi.mock('@/app/[loja]/progresso/actions', () => ({ saveCompletion: vi.fn() }))
vi.mock('@/lib/data/member-progress', () => ({ listCompletedItemIds: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/data/item-access', () => ({ recordItemAccess: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ getProductBySlug: vi.fn(), listModulesWithItems: vi.fn() }))
vi.mock('@/lib/data/access', () => ({ loadGrantedProductLevels: vi.fn() }))
vi.mock('@/lib/membros/session', () => ({ requireStoreSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/arquitetura', useSearchParams: () => new URLSearchParams(), notFound: vi.fn(), redirect: vi.fn() }))

const invitation = 'https://chat.whatsapp.com/Example?mode=gi_t'
const support = 'https://wa.me/5511999999999'
const store: Store = { id: 's', slug: 'arquitetura', name: 'Arquitetura', logoUrl: null, supportUrl: support, supportWhatsapp: null, loginImageUrl: null, communityWhatsappUrl: invitation }
const product: Product = { id: 'p', storeId: 's', slug: 'produto', title: 'Produto', track: '', description: '', coverUrl: null, bannerUrl: null, checkoutUrl: null, role: 'front', isFeatured: false, sortOrder: 0, isPublished: true }
const item: Item = { id: 'i', moduleId: 'm', title: 'Material', kind: 'arquivo', url: 'https://example.test/material.pdf', coverUrl: null, sortOrder: 0, isPublished: true }
const moduleData: ModuleWithItems = { id: 'm', productId: 'p', title: 'Materiais', sortOrder: 0, isPublished: true, items: [item] }
function documentFor(html: string) { const window = new Window(); window.document.body.innerHTML = html; return window.document }

describe('WhatsApp community pill', () => {
  it('renders the exact invitation with accessible text and safe new-tab attributes', () => {
    const document = documentFor(renderToStaticMarkup(createElement(CommunityWhatsapp, { url: invitation })))
    const link = document.querySelector('a')!
    expect(link.textContent).toBe('Entrar no grupo do WhatsApp')
    expect(link.getAttribute('href')).toBe(invitation)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
  it.each([null, undefined, '', 'javascript:alert(1)', 'https://evil.test/group', 'http://chat.whatsapp.com/Example'])('omits an absent or unsafe URL: %s', url => {
    expect(renderToStaticMarkup(createElement(CommunityWhatsapp, { url }))).toBe('')
  })
})

describe('member content integration', () => {
  beforeEach(() => {
    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer: { id: 'c', email: 'student@example.test', name: 'Aluno', blockedAt: null } })
    vi.mocked(getProductBySlug).mockResolvedValue(product)
    vi.mocked(loadGrantedProductLevels).mockResolvedValue(new Map([['p', 'complete']]))
  })
  it.each(['arquitetura', 'outra-loja'])('renders one group after lesson content while preserving support for %s', async slug => {
    const tree = await renderItemContent({ ctx: { product, item, module: moduleData }, store: { ...store, slug }, customer: null, level: 'complete', preview: false, blocked: false, productModules: [moduleData] })
    const document = documentFor(renderToStaticMarkup(tree))
    expect(document.querySelectorAll(`a[href="${invitation}"]`)).toHaveLength(1)
    expect(document.querySelector('main')?.nextElementSibling?.querySelector('a')?.getAttribute('href')).toBe(invitation)
    expect(document.querySelector(`a[href="${support}"]`)?.textContent).toBe('Falar pelo WhatsApp')
    expect(document.body.textContent).toContain('Abrir material')
  })
  it.each([invitation, null])('renders the empty-product branch with configured group %s and unchanged support', async url => {
    vi.mocked(requireStoreSession).mockResolvedValue({ store: { ...store, communityWhatsappUrl: url }, customer: { id: 'c', email: 'student@example.test', name: 'Aluno', blockedAt: null } })
    vi.mocked(listModulesWithItems).mockResolvedValue([])
    const document = documentFor(renderToStaticMarkup(await ProdutoPage({ params: Promise.resolve({ loja: store.slug, slug: product.slug }), searchParams: Promise.resolve({}) })))
    expect(document.querySelectorAll(`a[href="${invitation}"]`)).toHaveLength(url ? 1 : 0)
    expect(document.body.textContent).toContain('Nenhum conteúdo publicado ainda.')
    expect(document.querySelector('a[aria-label="Falar com o suporte"]')?.getAttribute('href')).toBe(support)
    if (url) expect(document.querySelector('main')?.nextElementSibling?.querySelector('a')?.getAttribute('href')).toBe(invitation)
  })
  it('omits the group from a lesson in a store without configuration', async () => {
    const tree = await renderItemContent({ ctx: { product, item, module: moduleData }, store: { ...store, slug: 'outra-loja', communityWhatsappUrl: null }, customer: null, level: 'complete', preview: false, blocked: false, productModules: [moduleData] })
    const document = documentFor(renderToStaticMarkup(tree))
    expect(document.body.textContent).not.toContain('Entrar no grupo do WhatsApp')
    expect(document.querySelector(`a[href="${support}"]`)).not.toBeNull()
  })
})
