import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notFound, redirect } from 'next/navigation'
import ItemPage from '@/app/[loja]/item/[id]/page'
import ProdutoPage from '@/app/[loja]/produto/[slug]/page'
import VitrinePage from '@/app/[loja]/page'
import { loadGrantedProductIds, loadStoreAccess } from '@/lib/data/access'
import { listRecentProductIds, recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext, getProductBySlug, listModulesWithItems, listPublishedItemsInModule } from '@/lib/data/products'
import type { CustomerRow, Item, Module, Product, Store } from '@/lib/domain/types'
import { requireStoreSession } from '@/lib/membros/session'

vi.mock('next/navigation', () => ({ notFound: vi.fn(), redirect: vi.fn() }))
vi.mock('@/lib/data/access', () => ({ loadGrantedProductIds: vi.fn(), loadStoreAccess: vi.fn() }))
vi.mock('@/lib/data/item-access', () => ({ listRecentProductIds: vi.fn(), recordItemAccess: vi.fn() }))
vi.mock('@/lib/data/products', () => ({
  getItemWithContext: vi.fn(),
  getProductBySlug: vi.fn(),
  listModulesWithItems: vi.fn(),
  listPublishedItemsInModule: vi.fn(),
}))
vi.mock('@/lib/membros/session', () => ({ requireStoreSession: vi.fn() }))

const store: Store = {
  id: 'store-a',
  slug: 'loja-a',
  name: 'Loja A',
  logoUrl: null,
  supportUrl: null,
  supportWhatsapp: null,
  loginImageUrl: null,
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
  slug: 'produto-a',
  title: 'Produto A',
  track: 'Trilha',
  description: 'Descrição do produto',
  coverUrl: null,
  bannerUrl: null,
  checkoutUrl: 'https://checkout.example.com',
  isFeatured: false,
  sortOrder: 1,
  isPublished: true,
}

const courseModule: Module = {
  id: 'module-a',
  productId: product.id,
  title: 'Módulo A',
  sortOrder: 1,
  isPublished: true,
}

const item: Item = {
  id: '11111111-1111-4111-8111-111111111111',
  moduleId: courseModule.id,
  title: 'Aula principal',
  kind: 'video',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  coverUrl: null,
  sortOrder: 1,
  isPublished: true,
}

const context = { item, module: courseModule, product }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

async function settle() {
  await Promise.resolve()
  await Promise.resolve()
}

function productProps(slug = product.slug) {
  return { params: Promise.resolve({ loja: store.slug, slug }), searchParams: Promise.resolve({}) }
}

function itemProps(id = item.id) {
  return { params: Promise.resolve({ loja: store.slug, id }), searchParams: Promise.resolve({}) }
}

describe('carregamento do conteúdo', () => {
  it('anuncia o carregamento e mantém formas decorativas fora da árvore acessível', async () => {
    const skeletons = await import('@/components/membros/skeletons')
    expect(skeletons).toHaveProperty('LessonSkeleton')
    const html = renderToStaticMarkup(createElement(skeletons.LessonSkeleton))

    expect(html).toContain('role="status"')
    expect(html).toContain('Carregando material…')
    expect(html).toContain('aspect-video')
    expect(html).toContain('aria-hidden="true"')
  })
})

describe('vitrine do aluno', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer })
    vi.mocked(loadStoreAccess).mockResolvedValue({ customer, products: [product], granted: new Set([product.id]) })
    vi.mocked(listRecentProductIds).mockResolvedValue([])
  })

  it('reutiliza o cliente validado ao carregar catálogo e permissões', async () => {
    const result = await VitrinePage({ params: Promise.resolve({ loja: store.slug }), searchParams: Promise.resolve({}) })
    renderToStaticMarkup(result)

    expect(loadStoreAccess).toHaveBeenCalledWith(store.id, customer)
  })

  it('mostra identidade e arte só na arquitetura sem inventar produtos', async () => {
    const arq = { ...store, slug: 'arquitetura' }
    vi.mocked(requireStoreSession).mockResolvedValue({ store: arq, customer })
    vi.mocked(loadStoreAccess).mockResolvedValue({
      customer, products: [{ ...product, slug: 'atlas-visual-das-patologias' }], granted: new Set([product.id]),
    })
    const html = renderToStaticMarkup(await VitrinePage({ params: Promise.resolve({ loja: arq.slug }), searchParams: Promise.resolve({}) }))
    expect(html).toContain('Menos tempo no zero.')
    expect(html).toContain('atlas.webp')
    expect(html).toContain('/arquitetura/produto/atlas-visual-das-patologias')
    expect(html).not.toContain('PROJETOS RESIDENCIAIS')

    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer })
    const other = renderToStaticMarkup(await VitrinePage({ params: Promise.resolve({ loja: store.slug }), searchParams: Promise.resolve({}) }))
    expect(other).not.toContain('Menos tempo no zero.')
    expect(other).not.toContain('/themes/arquitetura/')
    expect(other).not.toContain('Meus materiais')
  })
})

describe('rota de produto', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(notFound).mockImplementation(() => { throw new Error('NEXT_NOT_FOUND') })
    vi.mocked(redirect).mockImplementation((path) => { throw new Error(`NEXT_REDIRECT:${path}`) })
    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer })
    vi.mocked(getProductBySlug).mockResolvedValue(product)
    vi.mocked(loadGrantedProductIds).mockResolvedValue(new Set([product.id]))
    vi.mocked(loadStoreAccess).mockResolvedValue({ customer, products: [product], granted: new Set([product.id]) })
    vi.mocked(listModulesWithItems).mockResolvedValue([{ ...courseModule, items: [item] }])
  })

  it('inicia produto e permissão antes de qualquer um terminar', async () => {
    const pendingProduct = deferred<Product | null>()
    const pendingGranted = deferred<Set<string>>()
    vi.mocked(getProductBySlug).mockReturnValueOnce(pendingProduct.promise)
    vi.mocked(loadGrantedProductIds).mockReturnValueOnce(pendingGranted.promise)

    const rendering = ProdutoPage(productProps())
    await settle()
    const callsBeforeResolution = [getProductBySlug, loadGrantedProductIds].map((mock) => vi.mocked(mock).mock.calls.length)

    pendingProduct.resolve(product)
    pendingGranted.resolve(new Set([product.id]))
    await rendering

    expect(callsBeforeResolution).toEqual([1, 1])
  })

  it('prioriza 404 de produto ausente ou oculto sobre compra', async () => {
    vi.mocked(loadGrantedProductIds).mockResolvedValue(new Set())

    vi.mocked(getProductBySlug).mockResolvedValueOnce(null)
    await expect(ProdutoPage(productProps('ausente'))).rejects.toThrow('NEXT_NOT_FOUND')

    vi.mocked(getProductBySlug).mockResolvedValueOnce({ ...product, isPublished: false })
    await expect(ProdutoPage(productProps())).rejects.toThrow('NEXT_NOT_FOUND')

    expect(loadGrantedProductIds).toHaveBeenCalledTimes(2)
    expect(redirect).not.toHaveBeenCalled()
    expect(listModulesWithItems).not.toHaveBeenCalled()
  })

  it('redireciona produto não comprado sem carregar módulos', async () => {
    vi.mocked(loadGrantedProductIds).mockResolvedValue(new Set())

    await expect(ProdutoPage(productProps()))
      .rejects.toThrow(`NEXT_REDIRECT:/${store.slug}?comprar=${product.slug}`)
    expect(listModulesWithItems).not.toHaveBeenCalled()
  })

  it('renderiza conteúdo somente depois da autorização', async () => {
    const result = await ProdutoPage(productProps())
    const html = renderToStaticMarkup(result)

    expect(loadStoreAccess).not.toHaveBeenCalled()
    expect(html).toContain(product.title)
    expect(html).toContain(item.title)
    expect(listModulesWithItems).toHaveBeenCalledWith(product.id, { publishedOnly: true })
  })

  it('separa aulas e downloads por módulo sem expor URLs externas na capa', async () => {
    const file = { ...item, id: '22222222-2222-4222-8222-222222222222', kind: 'arquivo' as const, title: 'Apostila da aula', url: 'https://files.example.com/a.pdf' }
    const link = { ...item, id: '33333333-3333-4333-8333-333333333333', kind: 'link' as const, title: 'Versão editável', url: 'https://drive.example.com/doc' }
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, items: [item, file, link] }])
    const html = renderToStaticMarkup(await ProdutoPage(productProps()))
    expect(html).toContain('Aulas em vídeo')
    expect(html).toContain('Downloads e links')
    expect(html).toContain(`href="/${store.slug}/item/${file.id}/abrir"`)
    expect(html).toContain(`href="/${store.slug}/item/${link.id}/abrir"`)
    expect(html).not.toContain(file.url)
    expect(html).not.toContain(link.url)
  })

  it('não cria seção vazia para recursos com destino inválido', async () => {
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, items: [item, { ...item, id: '22222222-2222-4222-8222-222222222222', kind: 'arquivo', url: 'javascript:alert(1)' }] }])
    const html = renderToStaticMarkup(await ProdutoPage(productProps()))
    expect(html).toContain('Aulas em vídeo')
    expect(html).not.toContain('Downloads e links')
  })

  it('mostra estado vazio quando nenhum item publicado pode ser aberto', async () => {
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, items: [{ ...item, kind: 'arquivo', url: 'javascript:alert(1)' }] }])
    const html = renderToStaticMarkup(await ProdutoPage(productProps()))
    expect(html).toContain('Nenhum conteúdo publicado ainda.')
    expect(html).not.toContain('Downloads e links')
  })
})

describe('rota de item', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(notFound).mockImplementation(() => { throw new Error('NEXT_NOT_FOUND') })
    vi.mocked(redirect).mockImplementation((path) => { throw new Error(`NEXT_REDIRECT:${path}`) })
    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer })
    vi.mocked(getItemWithContext).mockResolvedValue(context)
    vi.mocked(loadGrantedProductIds).mockResolvedValue(new Set([product.id]))
    vi.mocked(loadStoreAccess).mockResolvedValue({ customer, products: [product], granted: new Set([product.id]) })
    vi.mocked(recordItemAccess).mockResolvedValue()
    vi.mocked(listModulesWithItems).mockResolvedValue([{ ...courseModule, items: [item] }])
    vi.mocked(listPublishedItemsInModule).mockResolvedValue([item])
  })

  it('inicia contexto e permissão antes de qualquer um terminar', async () => {
    const pendingContext = deferred<typeof context | null>()
    const pendingGranted = deferred<Set<string>>()
    vi.mocked(getItemWithContext).mockReturnValueOnce(pendingContext.promise)
    vi.mocked(loadGrantedProductIds).mockReturnValueOnce(pendingGranted.promise)

    const rendering = ItemPage(itemProps())
    await settle()
    const callsBeforeResolution = [getItemWithContext, loadGrantedProductIds].map((mock) => vi.mocked(mock).mock.calls.length)

    pendingContext.resolve(context)
    pendingGranted.resolve(new Set([product.id]))
    await rendering

    expect(callsBeforeResolution).toEqual([1, 1])
  })

  it('prioriza 404 para conteúdo ausente, de outra loja ou oculto e nunca registra acesso', async () => {
    vi.mocked(loadGrantedProductIds).mockResolvedValue(new Set())
    const invalidContexts = [
      null,
      { ...context, product: { ...product, storeId: 'store-b' } },
      { ...context, product: { ...product, isPublished: false } },
      { ...context, module: { ...courseModule, isPublished: false } },
      { ...context, item: { ...item, isPublished: false, url: 'https://privado.example.com/arquivo.pdf' } },
    ]

    for (const invalid of invalidContexts) {
      vi.mocked(getItemWithContext).mockResolvedValueOnce(invalid)
      await expect(ItemPage(itemProps())).rejects.toThrow('NEXT_NOT_FOUND')
    }

    expect(redirect).not.toHaveBeenCalled()
    expect(recordItemAccess).not.toHaveBeenCalled()
  })

  it('redireciona item não comprado sem registrar acesso', async () => {
    vi.mocked(loadGrantedProductIds).mockResolvedValue(new Set())

    await expect(ItemPage(itemProps()))
      .rejects.toThrow(`NEXT_REDIRECT:/${store.slug}?comprar=${product.slug}`)
    expect(recordItemAccess).not.toHaveBeenCalled()
    expect(listPublishedItemsInModule).not.toHaveBeenCalled()
  })

  it('inicia irmãos enquanto o registro do vídeo está pendente e aguarda ambos antes de renderizar', async () => {
    const pendingRecord = deferred<void>()
    const pendingSiblings = deferred<Item[]>()
    const recordStarted = deferred<void>()
    vi.mocked(recordItemAccess).mockImplementationOnce(() => {
      recordStarted.resolve()
      return pendingRecord.promise
    })
    vi.mocked(listPublishedItemsInModule).mockReturnValueOnce(pendingSiblings.promise)
    let pageResolved = false

    const rendering = ItemPage(itemProps()).then((page) => {
      pageResolved = true
      return page
    })
    await recordStarted.promise
    const siblingsStartedWhileRecording = vi.mocked(listPublishedItemsInModule).mock.calls.length
    const recordCalls = vi.mocked(recordItemAccess).mock.calls.length
    const resolvedWhilePending = pageResolved
    pendingRecord.resolve()
    pendingSiblings.resolve([item])
    const html = renderToStaticMarkup(await rendering)

    expect(recordCalls).toBe(1)
    expect(siblingsStartedWhileRecording).toBe(1)
    expect(resolvedWhilePending).toBe(false)
    expect(html).toContain(item.title)
  })

  it('propaga falha do registro do vídeo mesmo com irmãos carregados', async () => {
    vi.mocked(recordItemAccess).mockRejectedValueOnce(new Error('registro indisponível'))

    await expect(ItemPage(itemProps())).rejects.toThrow('registro indisponível')
    expect(listPublishedItemsInModule).toHaveBeenCalledWith(courseModule.id)
  })

  it('mostra a página interna de arquivo sem abrir ou registrar download antes do clique', async () => {
    const file = { ...item, kind: 'arquivo' as const, url: 'https://arquivos.example.com/material.pdf' }
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ ...context, item: file })
    vi.mocked(listPublishedItemsInModule).mockResolvedValueOnce([file])
    const html = renderToStaticMarkup(await ItemPage(itemProps()))
    expect(html).toContain(file.title)
    expect(html).toContain('Downloads e links')
    expect(html).toContain(`href="/${store.slug}/item/${file.id}/abrir"`)
    expect(html).not.toContain(file.url)
    expect(redirect).not.toHaveBeenCalled()
    expect(recordItemAccess).not.toHaveBeenCalled()
  })

  it('renderiza vídeo autorizado depois de registrar o acesso', async () => {
    const result = await ItemPage(itemProps())
    const html = renderToStaticMarkup(result)

    expect(loadStoreAccess).not.toHaveBeenCalled()
    expect(recordItemAccess).toHaveBeenCalledOnce()
    expect(html).toContain(item.title)
    expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('renderiza anterior e próximo usando somente irmãos publicados do módulo atual', async () => {
    const previous = { ...item, id: '22222222-2222-4222-8222-222222222222', title: 'Aula anterior', sortOrder: 0 }
    const next = { ...item, id: '33333333-3333-4333-8333-333333333333', title: 'Próxima aula', sortOrder: 2 }
    vi.mocked(listPublishedItemsInModule).mockResolvedValueOnce([previous, item, next])

    const result = await ItemPage(itemProps())
    const html = renderToStaticMarkup(result)

    expect(html).toContain(`href="/${store.slug}/item/${previous.id}"`)
    expect(html).toContain('Aula anterior')
    expect(html).toContain(`href="/${store.slug}/item/${next.id}"`)
    expect(html).toContain('Próxima aula')
    expect(listPublishedItemsInModule).toHaveBeenCalledWith(courseModule.id)
    expect(listModulesWithItems).not.toHaveBeenCalled()
  })
})
