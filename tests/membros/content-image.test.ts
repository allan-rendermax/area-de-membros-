import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EntrarPage from '@/app/[loja]/entrar/page'
import ProdutoPage from '@/app/[loja]/produto/[slug]/page'
import { AutoCover } from '@/components/membros/auto-cover'
import { ContentImage } from '@/components/membros/content-image'
import { Hero } from '@/components/membros/hero'
import { loadGrantedProductIds } from '@/lib/data/access'
import { getProductBySlug, listModulesWithItems } from '@/lib/data/products'
import type { CustomerRow, Product, Store } from '@/lib/domain/types'
import { getStore, requireStoreSession } from '@/lib/membros/session'

vi.mock('next/navigation', () => ({ notFound: vi.fn(), redirect: vi.fn() }))
vi.mock('@/components/membros/install-app-button', () => ({ InstallAppButton: () => null }))
vi.mock('@/components/membros/whatsapp-button', () => ({ WhatsAppFloating: () => null }))
vi.mock('@/app/[loja]/entrar/form', () => ({ EntrarForm: () => null }))
vi.mock('@/app/[loja]/entrar/actions', () => ({ entrar: vi.fn() }))
vi.mock('@/lib/auth/login-guard', () => ({ freshFormStamp: () => 'stamp' }))
vi.mock('@/lib/env', () => ({ env: { loginGuardSecret: 'test', turnstileSiteKey: '', turnstileSecretKey: '' } }))
vi.mock('@/lib/support/whatsapp', () => ({ supportHref: () => null }))
vi.mock('@/lib/data/access', () => ({ loadGrantedProductIds: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ getProductBySlug: vi.fn(), listModulesWithItems: vi.fn() }))
vi.mock('@/lib/membros/session', () => ({ getStore: vi.fn(), requireStoreSession: vi.fn() }))

const store: Store = {
  id: 'store-a',
  slug: 'arquitetura',
  name: 'Arquitetura',
  logoUrl: null,
  supportUrl: null,
  supportWhatsapp: null,
  loginImageUrl: '/covers/login.jpg',
}

const customer: CustomerRow = {
  id: 'customer-a',
  email: 'aluna@example.com',
  name: 'Aluna',
  blockedAt: null,
}

const product: Product = {
  id: 'product-a',
  storeId: store.id,
  slug: 'atlas',
  title: 'Atlas',
  track: 'Projetos',
  description: 'Descrição',
  coverUrl: '/covers/atlas.jpg',
  bannerUrl: '/covers/atlas-banner.jpg',
  checkoutUrl: null, role: 'front',
  isFeatured: true,
  sortOrder: 1,
  isPublished: true,
}

const shelfProduct = { ...product, unlocked: true }
const LOGIN_SIZES = '(min-width: 1280px) calc(100vw - 34rem), (min-width: 1024px) calc(100vw - 30rem), 100vw'

describe('ContentImage', () => {
  it('gera srcset responsivo e marca somente a imagem principal como eager/high', () => {
    const eagerHtml = renderToStaticMarkup(createElement(ContentImage, {
      src: '/covers/principal.jpg', sizes: '60vw', eager: true, className: 'object-cover opacity-40',
    }))
    const lazyHtml = renderToStaticMarkup(createElement(ContentImage, {
      src: '/covers/secundaria.webp', sizes: '25vw', className: 'h-full w-full object-cover',
    }))

    expect(eagerHtml).toContain('srcSet=')
    expect(eagerHtml).toContain('sizes="60vw"')
    expect(eagerHtml).toContain('loading="eager"')
    expect(eagerHtml).toContain('fetchPriority="high"')
    expect(eagerHtml).toContain('class="object-cover opacity-40"')
    expect(lazyHtml).toContain('srcSet=')
    expect(lazyHtml).toContain('sizes="25vw"')
    expect(lazyHtml).toContain('loading="lazy"')
    expect(lazyHtml).toContain('decoding="async"')
    expect(lazyHtml).not.toContain('fetchPriority="high"')
  })

  it('renderiza a fonte externa original sem srcset e preserva classes de recorte', () => {
    const html = renderToStaticMarkup(createElement(ContentImage, {
      src: 'https://images.example.com/capa.gif',
      sizes: '25vw',
      className: 'h-full w-full object-cover opacity-40 grayscale',
    }))

    expect(html).toContain('src="https://images.example.com/capa.gif"')
    expect(html).toContain('class="h-full w-full object-cover opacity-40 grayscale"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('decoding="async"')
    expect(html).not.toContain('srcSet=')
    expect(html).not.toContain('/_next/image')
  })
})

describe('capas responsivas', () => {
  it.each([
    ['poster', '(max-width: 639px) 40vw, (max-width: 767px) 26vw, (max-width: 1023px) 20vw, 15vw'],
    ['banner', '100vw'],
    ['episode', '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw'],
  ] as const)('usa o sizes padrão de %s', (aspect, sizes) => {
    const html = renderToStaticMarkup(createElement(AutoCover, {
      seed: 'seed', title: 'Título', imageUrl: '/covers/a.jpg', aspect,
    }))

    expect(html).toContain(`sizes="${sizes}"`)
    expect(html).toContain('loading="lazy"')
  })

  it('mantém o gradiente e o título quando não há URL', () => {
    const html = renderToStaticMarkup(createElement(AutoCover, {
      seed: 'seed', title: 'Título da capa', imageUrl: null, aspect: 'poster',
    }))

    expect(html).toContain('Título da capa')
    expect(html).toContain('background-image:')
    expect(html).not.toContain('<img')
  })

  it('marca o hero como eager/high e mantém o banner em 100vw', () => {
    const html = renderToStaticMarkup(createElement(Hero, { product: shelfProduct, storeSlug: store.slug }))

    expect(html).toContain('sizes="100vw"')
    expect(html).toContain('loading="eager"')
    expect(html).toContain('fetchPriority="high"')
  })
})

describe('banners principais de rota', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getStore).mockResolvedValue(store)
    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer })
    vi.mocked(getProductBySlug).mockResolvedValue(product)
    vi.mocked(loadGrantedProductIds).mockResolvedValue(new Set([product.id]))
    vi.mocked(listModulesWithItems).mockResolvedValue([])
  })

  it('usa a mesma seleção responsiva nos dois fundos de login', async () => {
    const element = await EntrarPage({
      params: Promise.resolve({ loja: store.slug }),
      searchParams: Promise.resolve({}),
    })
    const html = renderToStaticMarkup(element)

    expect(html.split(`sizes="${LOGIN_SIZES}"`)).toHaveLength(3)
    expect(html.split('loading="eager"')).toHaveLength(3)
  })

  it('abre o produto com título e descrição antes do conteúdo sem banner grande', async () => {
    const element = await ProdutoPage({
      params: Promise.resolve({ loja: store.slug, slug: product.slug }),
      searchParams: Promise.resolve({}),
    })
    const html = renderToStaticMarkup(element)

    expect(html).toMatch(/<h1[^>]*>Atlas<\/h1>/)
    expect(html).toContain(product.description)
    expect(html).not.toContain(product.bannerUrl)
  })
})
