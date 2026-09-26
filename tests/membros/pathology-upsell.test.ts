import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { describe, expect, it, vi } from 'vitest'
import { renderItemContent } from '@/components/membros/item-content'
import type { AccessLevel, Item, ModuleWithItems, Product, Store } from '@/lib/domain/types'

vi.mock('@/app/[loja]/progresso/actions', () => ({ saveCompletion: vi.fn() }))
vi.mock('@/lib/data/member-progress', () => ({ listCompletedItemIds: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/data/item-access', () => ({ recordItemAccess: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ listModulesWithItems: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/arquitetura', useSearchParams: () => new URLSearchParams() }))

const store: Store = {
  id: 'architecture-store', slug: 'arquitetura', name: 'Arquitetura',
  logoUrl: null, supportUrl: null, supportWhatsapp: null, loginImageUrl: null,
}
const product: Product = {
  id: 'atlas', storeId: store.id, slug: 'atlas-visual-das-patologias-na-construcao-civil-completo',
  title: 'Atlas Visual das Patologias na Construção Civil', track: 'Patologias', description: '',
  coverUrl: null, bannerUrl: null, checkoutUrl: null, contentMode: 'versions',
  role: 'front', isFeatured: false, sortOrder: 1, isPublished: true,
}
const basic: Item = { id: 'basic-file', moduleId: 'basic-module', title: 'Atlas Básico', kind: 'arquivo', url: 'https://example.test/basic.pdf', coverUrl: null, sortOrder: 1, isPublished: true }
const complete: Item = { ...basic, id: 'complete-file', moduleId: 'complete-module', title: 'Atlas Completo', url: 'https://example.test/complete.pdf' }
const modules: ModuleWithItems[] = [
  { id: basic.moduleId, productId: product.id, title: 'Básico', requiredLevel: 'basic', sortOrder: 0, isPublished: true, items: [basic] },
  { id: complete.moduleId, productId: product.id, title: 'Completo', requiredLevel: 'complete', sortOrder: 1, isPublished: true, items: [complete] },
]

async function render(level: AccessLevel, overrides: { storeSlug?: string; productSlug?: string } = {}) {
  const index = level === 'basic' ? 0 : 1
  const tree = await renderItemContent({
    ctx: { product: { ...product, slug: overrides.productSlug ?? product.slug }, module: modules[index], item: modules[index].items[0] },
    store: { ...store, slug: overrides.storeSlug ?? store.slug },
    customer: { id: 'student', email: 'student@example.test', name: 'Aluno', blockedAt: null },
    level, preview: false, blocked: false, productModules: modules,
  })
  const window = new Window()
  window.document.body.innerHTML = renderToStaticMarkup(tree)
  return window.document
}

describe('oferta do Protocolo dentro do Atlas', () => {
  it.each(['basic', 'complete'] as const)('inclui a oferta após os materiais no %s sem substituir conteúdo ou navegação', async (level) => {
    const document = await render(level)
    const materialSection = document.querySelector('section[aria-label="Materiais disponíveis"]')!
    const offer = materialSection.nextElementSibling!
    expect(offer.textContent).toContain('Você deixou isso passar no checkout.')
    expect(offer.textContent).toContain('sequência correta Causa → Interrupção → Acabamento')
    const checkout = offer.querySelector('a')!
    expect(checkout.getAttribute('href')).toBe('https://checkout.payt.com.br/f2b5337a076c0be3ccd09fdcfc651601')
    expect(checkout.getAttribute('target')).toBe('_blank')
    expect(checkout.getAttribute('rel')).toBe('noopener noreferrer')
    expect(materialSection.textContent).toContain(level === 'basic' ? 'Atlas Básico' : 'Atlas Completo')
    expect(document.querySelector('aside[aria-label="Conteúdos do produto"]')).not.toBeNull()
    expect(document.body.textContent).toContain('Precisa de ajuda?')
    expect(document.body.textContent).toContain('Concluir')
  })

  it.each([
    { storeSlug: 'outra-loja' },
    { productSlug: 'protocolo-anti-retrabalho' },
    { productSlug: 'atlas-visual-das-patologias-na-construcao-civil-completo-outro' },
  ])('não insere oferta fora do produto e loja selecionados: %j', async (overrides) => {
    const document = await render('complete', overrides)
    expect(document.body.textContent).not.toContain('Você deixou isso passar no checkout.')
    expect(document.querySelector('a[href*="f2b5337a076c0be3ccd09fdcfc651601"]')).toBeNull()
  })
})
