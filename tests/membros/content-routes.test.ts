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
  })

  it('aguarda o registro autorizado antes de abrir arquivo externo', async () => {
    const file = { ...item, kind: 'arquivo' as const, url: 'https://arquivos.example.com/material.pdf' }
    const pendingRecord = deferred<void>()
    const recordStarted = deferred<void>()
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ ...context, item: file })
    vi.mocked(recordItemAccess).mockImplementationOnce(() => {
      recordStarted.resolve()
      return pendingRecord.promise
    })

    const rendering = ItemPage(itemProps())
    await recordStarted.promise

    expect(recordItemAccess).toHaveBeenCalledWith({
      customerId: customer.id,
      storeId: store.id,
      productId: product.id,
      itemId: file.id,
      kind: file.kind,
    })
    expect(redirect).not.toHaveBeenCalled()

    pendingRecord.resolve()
    await expect(rendering).rejects.toThrow(`NEXT_REDIRECT:${file.url}`)
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
    expect(html).toContain('← Anterior')
    expect(html).toContain(`href="/${store.slug}/item/${next.id}"`)
    expect(html).toContain('Próximo →')
    expect(listPublishedItemsInModule).toHaveBeenCalledWith(courseModule.id)
    expect(listModulesWithItems).not.toHaveBeenCalled()
  })
})
