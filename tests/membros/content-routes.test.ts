import { listCompletedItemIds } from '@/lib/data/member-progress'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notFound, redirect } from 'next/navigation'
import ItemPage from '@/app/[loja]/item/[id]/page'
import ProdutoPage from '@/app/[loja]/produto/[slug]/page'
import VitrinePage from '@/app/[loja]/page'
import { loadGrantedProductIds, loadStoreAccess } from '@/lib/data/access'
import { listRecentProductIds, listRecentMaterials, recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext, getProductBySlug, listModulesWithItems } from '@/lib/data/products'
import type { CustomerRow, Item, Module, ModuleWithItems, Product, Store } from '@/lib/domain/types'
import { requireStoreSession } from '@/lib/membros/session'

vi.mock('@/app/[loja]/progresso/actions', () => ({ saveCompletion: vi.fn() }))
vi.mock('@/lib/data/member-progress', () => ({ listCompletedItemIds: vi.fn().mockResolvedValue([]) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/loja-a', useSearchParams: () => new URLSearchParams(), useRouter: () => ({ refresh: vi.fn() }), notFound: vi.fn(), redirect: vi.fn() }))
vi.mock('@/lib/data/access', () => ({ loadGrantedProductIds: vi.fn(), loadStoreAccess: vi.fn() }))
vi.mock('@/lib/data/item-access', () => ({ listRecentProductIds: vi.fn().mockResolvedValue([]), listRecentMaterials: vi.fn(), recordItemAccess: vi.fn() }))
vi.mock('@/lib/data/products', () => ({
  getItemWithContext: vi.fn(),
  getProductBySlug: vi.fn(),
  listModulesWithItems: vi.fn(),
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
    vi.mocked(listCompletedItemIds).mockResolvedValue([])
    vi.mocked(listRecentProductIds).mockResolvedValue([])
    vi.mocked(listRecentMaterials).mockResolvedValue([])
    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer })
    vi.mocked(loadStoreAccess).mockResolvedValue({ customer, products: [product], granted: new Set([product.id]) })
    vi.mocked(listRecentMaterials).mockResolvedValue([])
  })

  it('restaura carrosséis de compras, ofertas e produtos recentes', async () => {
    vi.mocked(loadStoreAccess).mockResolvedValue({ customer, products: [product, { ...product, id: 'locked', slug: 'locked', title: 'Oferta bloqueada' }], granted: new Set([product.id]) })
    vi.mocked(listRecentProductIds).mockResolvedValue([product.id])
    const html = renderToStaticMarkup(await VitrinePage({ params: Promise.resolve({ loja: store.slug }), searchParams: Promise.resolve({}) }))
    expect(html).toContain('Continuar')
    expect(html).toContain(`href="/${store.slug}/produto/${product.slug}"`)
    expect(html).toContain('Oferta bloqueada')
    expect(html).not.toContain('Seu acervo, pronto para usar')
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
    expect(html).toContain('Tudo pronto para você criar')
    expect(html).toContain('atlas.webp')
    expect(html).toContain('/arquitetura/produto/atlas-visual-das-patologias')
    expect(html).not.toContain('PROJETOS RESIDENCIAIS')

    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer })
    const other = renderToStaticMarkup(await VitrinePage({ params: Promise.resolve({ loja: store.slug }), searchParams: Promise.resolve({}) }))
    expect(other).not.toContain('Menos tempo no zero.')
    expect(other).not.toContain('/themes/arquitetura/')
    expect(other).toContain(product.title)
  })
})

describe('rota de produto', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(listCompletedItemIds).mockResolvedValue([])
    vi.mocked(listRecentProductIds).mockResolvedValue([])
    vi.mocked(listRecentMaterials).mockResolvedValue([])
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

  it('mantém a apresentação original do produto sem retomada', async () => {
    vi.mocked(listRecentMaterials).mockResolvedValue([{ itemId: item.id, title: item.title, kind: item.kind, productId: product.id, productTitle: product.title, productSlug: product.slug }])
    const html = renderToStaticMarkup(await ProdutoPage(productProps()))
    expect(html).not.toContain('Retomar material')
    expect(listRecentMaterials).not.toHaveBeenCalled()
    expect(html.match(/<aside/g)).toHaveLength(1)
    expect(html).toContain('Abrir primeiro conteúdo')
    expect(html).toContain('Seu material')
    expect(html).toContain('lesson-workspace-grid')
    expect(html).not.toContain('lesson-contents')
    expect(html).toContain('<h2 class="lesson-sidebar-heading')
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
    vi.mocked(listCompletedItemIds).mockResolvedValue([])
    vi.mocked(listRecentProductIds).mockResolvedValue([])
    vi.mocked(listRecentMaterials).mockResolvedValue([])
    vi.mocked(notFound).mockImplementation(() => { throw new Error('NEXT_NOT_FOUND') })
    vi.mocked(redirect).mockImplementation((path) => { throw new Error(`NEXT_REDIRECT:${path}`) })
    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer })
    vi.mocked(getItemWithContext).mockResolvedValue(context)
    vi.mocked(loadGrantedProductIds).mockResolvedValue(new Set([product.id]))
    vi.mocked(loadStoreAccess).mockResolvedValue({ customer, products: [product], granted: new Set([product.id]) })
    vi.mocked(recordItemAccess).mockResolvedValue()
    vi.mocked(listModulesWithItems).mockResolvedValue([{ ...courseModule, items: [item] }])
  })

  const nextModule = { ...courseModule, id: 'module-b', title: 'Módulo B', sortOrder: 2 }
  const nextLesson = { ...item, id: '33333333-3333-4333-8333-333333333333', moduleId: nextModule.id, title: 'Primeira aula B' }
  const windows: Window[] = []
  afterEach(async () => { await Promise.all(windows.splice(0).map((window) => window.happyDOM.close())) })

  async function renderedItem(id = item.id) {
    const window = new Window()
    windows.push(window)
    window.document.body.innerHTML = renderToStaticMarkup(await ItemPage(itemProps(id)))
    return window.document
  }

  it('mantém downloads acessíveis com aviso quando a leitura de progresso falha', async () => {
    vi.mocked(listCompletedItemIds).mockRejectedValueOnce(new Error('migration unavailable'))
    const doc = await renderedItem()
    expect(doc.querySelector('[role="status"]')?.textContent).toContain('Não foi possível carregar seu progresso')
    expect(doc.querySelector('iframe')).not.toBeNull()
    expect([...doc.querySelectorAll('button[disabled]')].some((node) => node.textContent === 'Concluir')).toBe(true)
    expect(doc.body.textContent).not.toContain('Progresso salvo')
  })

  it('marca conclusão e item atual no único sumário', async () => {
    vi.mocked(listCompletedItemIds).mockResolvedValueOnce([item.id])
    const doc = await renderedItem()
    expect(doc.querySelectorAll('aside')).toHaveLength(1)
    expect(doc.querySelector('aside [aria-current="page"]')?.textContent).toContain('Concluído')
    expect(doc.querySelector('aside [aria-current="page"]')?.textContent).toContain('Conteúdo atual')
  })

  it('avança para o módulo seguinte e exibe todos os módulos, abrindo apenas o atual', async () => {
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([
      { ...courseModule, items: [item] }, { ...nextModule, items: [nextLesson] },
    ])
    const doc = await renderedItem()
    expect(doc.querySelector('a[title="Primeira aula B"]')?.getAttribute('href')).toBe(`/loja-a/item/${nextLesson.id}`)
    const sidebar = doc.querySelector('aside')!
    expect([...sidebar.querySelectorAll('.lesson-module > summary')].map((node) => node.textContent)).toEqual(['Módulo A1⌄', 'Módulo B1⌄'])
    expect([...sidebar.querySelectorAll('.lesson-module')].map((node) => node.hasAttribute('open'))).toEqual([true, false])
    expect(sidebar.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe(`/loja-a/item/${item.id}`)
  })

  it('volta ao módulo anterior e desabilita próxima somente no fim do produto', async () => {
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ item: nextLesson, module: nextModule, product })
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([
      { ...courseModule, items: [item] }, { ...nextModule, items: [nextLesson] },
    ])
    const doc = await renderedItem(nextLesson.id)
    expect(doc.querySelector('a[title="Aula principal"]')?.getAttribute('href')).toBe(`/loja-a/item/${item.id}`)
    expect([...doc.querySelectorAll('button[disabled]')].map((node) => node.textContent)).toContain('Próximo conteúdo')
    expect([...doc.querySelectorAll('aside .lesson-module')].map((node) => node.hasAttribute('open'))).toEqual([false, true])
  })

  it('pula módulos vazios, rascunhos e destinos inválidos na navegação e no painel', async () => {
    const hidden = { ...item, id: 'hidden', title: 'Conteúdo oculto', isPublished: false }
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([
      { ...courseModule, items: [item, hidden] },
      { ...nextModule, id: 'empty', title: 'Vazio', items: [] },
      { ...nextModule, id: 'draft', title: 'Rascunho', isPublished: false, items: [{ ...nextLesson, id: 'draft-item' }] },
      { ...nextModule, id: 'invalid', title: 'Inválido', items: [
        { ...item, id: 'bad-video', url: 'https://example.com/video' },
        { ...item, id: 'bad-file', kind: 'arquivo', url: 'javascript:alert(1)' },
      ] },
      { ...nextModule, items: [nextLesson] },
    ])
    const doc = await renderedItem()
    expect(doc.querySelector('a[title="Primeira aula B"]')?.getAttribute('href')).toBe(`/loja-a/item/${nextLesson.id}`)
    expect([...doc.querySelectorAll('aside a')].map((node) => node.getAttribute('href'))).toEqual([
      `/loja-a/item/${item.id}`, `/loja-a/item/${nextLesson.id}`,
    ])
    expect(doc.querySelectorAll('aside .lesson-module')).toHaveLength(2)
  })

  it('mantém downloads do módulo atual mesmo quando o painel inclui materiais de outro módulo', async () => {
    const localFile = { ...item, id: 'local-file', kind: 'arquivo' as const, title: 'PDF do módulo A', url: 'https://example.com/a.pdf' }
    const otherFile = { ...nextLesson, id: 'other-file', kind: 'arquivo' as const, title: 'PDF do módulo B', url: 'https://example.com/b.pdf' }
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([
      { ...courseModule, items: [item, localFile] }, { ...nextModule, items: [otherFile] },
    ])
    const doc = await renderedItem()
    const downloads = doc.querySelector('section[aria-label="Downloads e links"]')!
    expect(downloads.querySelector('a')?.getAttribute('href')).toBe('/loja-a/item/local-file/abrir')
    expect(downloads.textContent).not.toContain('PDF do módulo B')
    expect(doc.querySelector('aside a[href="/loja-a/item/other-file"]')).not.toBeNull()
    expect([...doc.querySelectorAll('button[disabled]')].map((node) => node.textContent)).toContain('Conteúdo anterior')
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
    expect(listModulesWithItems).not.toHaveBeenCalled()
  })

  it('redireciona item não comprado sem registrar acesso', async () => {
    vi.mocked(loadGrantedProductIds).mockResolvedValue(new Set())

    await expect(ItemPage(itemProps()))
      .rejects.toThrow(`NEXT_REDIRECT:/${store.slug}?comprar=${product.slug}`)
    expect(recordItemAccess).not.toHaveBeenCalled()
    expect(listModulesWithItems).not.toHaveBeenCalled()
  })

  it('inicia módulos enquanto o registro do vídeo está pendente e aguarda ambos antes de renderizar', async () => {
    const pendingRecord = deferred<void>()
    const pendingModules = deferred<ModuleWithItems[]>()
    const recordStarted = deferred<void>()
    vi.mocked(recordItemAccess).mockImplementationOnce(() => {
      recordStarted.resolve()
      return pendingRecord.promise
    })
    vi.mocked(listModulesWithItems).mockReturnValueOnce(pendingModules.promise)
    let pageResolved = false

    const rendering = ItemPage(itemProps()).then((page) => {
      pageResolved = true
      return page
    })
    await recordStarted.promise
    const modulesStartedWhileRecording = vi.mocked(listModulesWithItems).mock.calls.length
    const recordCalls = vi.mocked(recordItemAccess).mock.calls.length
    const resolvedWhilePending = pageResolved
    pendingRecord.resolve()
    pendingModules.resolve([{ ...courseModule, items: [item] }])
    const html = renderToStaticMarkup(await rendering)

    expect(recordCalls).toBe(1)
    expect(modulesStartedWhileRecording).toBe(1)
    expect(resolvedWhilePending).toBe(false)
    expect(html).toContain(item.title)
  })

  it('propaga falha do registro do vídeo mesmo com módulos carregados', async () => {
    vi.mocked(recordItemAccess).mockRejectedValueOnce(new Error('registro indisponível'))

    await expect(ItemPage(itemProps())).rejects.toThrow('registro indisponível')
    expect(listModulesWithItems).toHaveBeenCalledWith(product.id, { publishedOnly: true })
  })

  it('mostra a página interna de arquivo sem abrir ou registrar download antes do clique', async () => {
    const file = { ...item, kind: 'arquivo' as const, url: 'https://arquivos.example.com/material.pdf' }
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ ...context, item: file })
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, items: [file] }])
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

  it('preserva a ordem de anterior e próximo dentro do mesmo módulo', async () => {
    const previous = { ...item, id: '22222222-2222-4222-8222-222222222222', title: 'Aula anterior', sortOrder: 0 }
    const next = { ...item, id: '33333333-3333-4333-8333-333333333333', title: 'Próxima aula', sortOrder: 2 }
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, items: [previous, item, next] }])

    const result = await ItemPage(itemProps())
    const html = renderToStaticMarkup(result)

    expect(html).toContain(`href="/${store.slug}/item/${previous.id}"`)
    expect(html).toContain('Conteúdo anterior')
    expect(html).toContain(`href="/${store.slug}/item/${next.id}"`)
    expect(html).toContain('Próximo conteúdo')
    expect(listModulesWithItems).toHaveBeenCalledWith(product.id, { publishedOnly: true })
  })
})
