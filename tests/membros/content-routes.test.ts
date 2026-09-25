import { listCompletedItemIds } from '@/lib/data/member-progress'
import { Children, createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notFound, redirect } from 'next/navigation'
import { LessonSidebar } from '@/components/membros/lesson-sidebar'
import ItemPage from '@/app/[loja]/item/[id]/page'
import ProdutoPage from '@/app/[loja]/produto/[slug]/page'
import VitrinePage from '@/app/[loja]/page'
import { loadGrantedProductLevels, loadStoreAccess } from '@/lib/data/access'
import { listRecentProductIds, listRecentMaterials, recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext, getProductBySlug, listModulesWithItems } from '@/lib/data/products'
import type { CustomerRow, Item, Module, ModuleWithItems, Product, Store } from '@/lib/domain/types'
import { requireStoreSession } from '@/lib/membros/session'

vi.mock('@/app/[loja]/progresso/actions', () => ({ saveCompletion: vi.fn() }))
vi.mock('@/lib/data/member-progress', () => ({ listCompletedItemIds: vi.fn().mockResolvedValue([]) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/loja-a', useSearchParams: () => new URLSearchParams(), useRouter: () => ({ refresh: vi.fn() }), notFound: vi.fn(), redirect: vi.fn() }))
vi.mock('@/lib/data/access', () => ({ loadGrantedProductLevels: vi.fn(), loadStoreAccess: vi.fn() }))
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
  checkoutUrl: 'https://checkout.example.com', role: 'front',
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
    vi.mocked(loadStoreAccess).mockResolvedValue({ customer, products: [product], granted: new Set([product.id]), levels: new Map([[product.id, 'complete']]) })
  })

  it('restaura carrosséis de compras, ofertas e produtos recentes', async () => {
    vi.mocked(loadStoreAccess).mockResolvedValue({ customer, products: [product, { ...product, id: 'locked', slug: 'locked', title: 'Oferta bloqueada' }], granted: new Set([product.id]), levels: new Map([[product.id, 'complete']]) })
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
      customer, products: [{ ...product, slug: 'atlas-visual-das-patologias' }], granted: new Set([product.id]), levels: new Map([[product.id, 'complete']]),
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
    vi.mocked(loadGrantedProductLevels).mockResolvedValue(new Map([[product.id, 'complete']]))
    vi.mocked(loadStoreAccess).mockResolvedValue({ customer, products: [product], granted: new Set([product.id]), levels: new Map([[product.id, 'complete']]) })
    vi.mocked(listModulesWithItems).mockResolvedValue([{ ...courseModule, items: [item] }])
  })

  it('inicia produto e permissão antes de qualquer um terminar', async () => {
    const pendingProduct = deferred<Product | null>()
    const pendingGranted = deferred<Map<string, 'basic' | 'complete'>>()
    vi.mocked(getProductBySlug).mockReturnValueOnce(pendingProduct.promise)
    vi.mocked(loadGrantedProductLevels).mockReturnValueOnce(pendingGranted.promise)

    const rendering = ProdutoPage(productProps())
    await settle()
    const callsBeforeResolution = [getProductBySlug, loadGrantedProductLevels].map((mock) => vi.mocked(mock).mock.calls.length)

    pendingProduct.resolve(product)
    pendingGranted.resolve(new Map([[product.id, 'complete']]))
    await expect(rendering).rejects.toThrow(`NEXT_REDIRECT:/${store.slug}/item/${item.id}`)

    expect(callsBeforeResolution).toEqual([1, 1])
  })

  it('prioriza 404 de produto ausente ou oculto sobre compra', async () => {
    vi.mocked(loadGrantedProductLevels).mockResolvedValue(new Map())

    vi.mocked(getProductBySlug).mockResolvedValueOnce(null)
    await expect(ProdutoPage(productProps('ausente'))).rejects.toThrow('NEXT_NOT_FOUND')

    vi.mocked(getProductBySlug).mockResolvedValueOnce({ ...product, isPublished: false })
    await expect(ProdutoPage(productProps())).rejects.toThrow('NEXT_NOT_FOUND')

    expect(loadGrantedProductLevels).toHaveBeenCalledTimes(2)
    expect(redirect).not.toHaveBeenCalled()
    expect(listModulesWithItems).not.toHaveBeenCalled()
  })

  it('redireciona produto não comprado sem carregar módulos', async () => {
    vi.mocked(loadGrantedProductLevels).mockResolvedValue(new Map())

    await expect(ProdutoPage(productProps()))
      .rejects.toThrow(`NEXT_REDIRECT:/${store.slug}?comprar=${product.slug}`)
    expect(listModulesWithItems).not.toHaveBeenCalled()
  })

  it.each(['video', 'arquivo', 'link'] as const)('abre diretamente o primeiro conteúdo do tipo %s depois da autorização', async (kind) => {
    const first = { ...item, kind, url: kind === 'video' ? item.url : 'https://example.com/material.pdf' }
    vi.mocked(listModulesWithItems).mockResolvedValue([{ ...courseModule, items: [first] }])
    await expect(ProdutoPage(productProps())).rejects.toThrow(`NEXT_REDIRECT:/${store.slug}/item/${item.id}`)
    expect(loadStoreAccess).not.toHaveBeenCalled()
    expect(recordItemAccess).not.toHaveBeenCalled()
    expect(listModulesWithItems).toHaveBeenCalledWith(product.id, { publishedOnly: true })
  })

  it('pula módulos bloqueados, rascunhos, vazios e itens inválidos ao abrir pela capa', async () => {
    vi.mocked(loadGrantedProductLevels).mockResolvedValueOnce(new Map([[product.id, 'basic']]))
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([
      { ...courseModule, id: 'locked', requiredLevel: 'complete', items: [{ ...item, id: 'locked-item' }] },
      { ...courseModule, id: 'draft', isPublished: false, items: [{ ...item, id: 'draft-module-item' }] },
      { ...courseModule, id: 'empty', items: [] },
      { ...courseModule, items: [
        { ...item, id: 'draft-item', isPublished: false },
        { ...item, id: 'bad-video', url: 'https://example.com/video' },
        { ...item, id: 'bad-file', kind: 'arquivo', url: 'javascript:alert(1)' }, item,
      ] },
    ])
    await expect(ProdutoPage(productProps())).rejects.toThrow(`NEXT_REDIRECT:/${store.slug}/item/${item.id}`)
  })

  it('leva o aviso de conteúdo bloqueado à tela de conteúdo sem criar uma etapa extra', async () => {
    await expect(ProdutoPage({ ...productProps(), searchParams: Promise.resolve({ bloqueado: '1' }) }))
      .rejects.toThrow(`NEXT_REDIRECT:/${store.slug}/item/${item.id}?bloqueado=1`)
  })

  it('mostra estado vazio quando nenhum item publicado pode ser aberto', async () => {
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, items: [{ ...item, kind: 'arquivo', url: 'javascript:alert(1)' }] }])
    const html = renderToStaticMarkup(await ProdutoPage(productProps()))
    expect(html).toContain('Nenhum conteúdo publicado ainda.')
    expect(html).not.toContain('Downloads e links')
  })

  it('mostra extras bloqueados sem itens ou destinos e oferece upgrade ao Básico', async () => {
    const extra = { ...courseModule, id: 'extra', title: 'Modelos exclusivos', requiredLevel: 'complete' as const }
    const privateItem = { ...item, id: '44444444-4444-4444-8444-444444444444', moduleId: extra.id, kind: 'arquivo' as const, title: 'Modelo secreto', url: 'https://project.supabase.co/storage/v1/object/authenticated/arquivos-restritos/modelo.pdf' }
    vi.mocked(loadGrantedProductLevels).mockResolvedValueOnce(new Map([[product.id, 'basic']]))
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ ...context, product: { ...product, upgradeCheckoutUrl: 'https://checkout.example.com/upgrade' } })
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, items: [item] }, { ...extra, items: [privateItem] }])

    const html = renderToStaticMarkup(await ItemPage(itemProps()))
    expect(html).not.toContain('Seu acesso:')
    expect(html).toContain('Modelos exclusivos')
    expect(html).toContain('1 conteúdo bloqueado</span>')
    expect(html).toContain('Desbloquear versão completa')
    expect(html).toContain('href="https://checkout.example.com/upgrade"')
    expect(html).toContain('Já paguei, atualizar acesso')
    expect(html).not.toContain(privateItem.title)
    expect(html).not.toContain(privateItem.id)
    expect(html).not.toContain(privateItem.url)
  })

  it('exibe extras e evita CTA quando acesso é Completo', async () => {
    const extra = { ...courseModule, id: 'extra', title: 'Modelos exclusivos', requiredLevel: 'complete' as const }
    const privateItem = { ...item, id: '44444444-4444-4444-8444-444444444444', moduleId: extra.id, kind: 'arquivo' as const, title: 'Modelo secreto', url: 'https://project.supabase.co/storage/v1/object/authenticated/arquivos-restritos/modelo.pdf' }
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ ...context, product: { ...product, upgradeCheckoutUrl: 'https://checkout.example.com/upgrade' } })
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, items: [item] }, { ...extra, items: [privateItem] }])

    const html = renderToStaticMarkup(await ItemPage(itemProps()))
    expect(html).not.toContain('Seu acesso:')
    expect(html).toContain(privateItem.title)
    expect(html).not.toContain('Desbloquear versão completa')
  })

  it('orienta suporte quando existe extra sem checkout válido', async () => {
    const extra = { ...courseModule, id: 'extra', requiredLevel: 'complete' as const }
    vi.mocked(loadGrantedProductLevels).mockResolvedValueOnce(new Map([[product.id, 'basic']]))
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...extra, items: [item] }])
    const html = renderToStaticMarkup(await ProdutoPage(productProps()))
    expect(html).toContain('entre em contato com o suporte')
    expect(html).not.toContain('Desbloquear versão completa')
    expect(html).not.toContain(item.id)
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
    vi.mocked(loadGrantedProductLevels).mockResolvedValue(new Map([[product.id, 'complete']]))
    vi.mocked(loadStoreAccess).mockResolvedValue({ customer, products: [product], granted: new Set([product.id]), levels: new Map([[product.id, 'complete']]) })
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

  it('volta diretamente ao acervo sem reabrir a página intermediária', async () => {
    const doc = await renderedItem()
    expect(doc.querySelector('a[aria-label="Voltar ao acervo"]')?.getAttribute('href')).toBe('/loja-a')
    expect(doc.querySelector('header a[href="/loja-a/produto/produto-a"]')).toBeNull()
  })

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
    const downloads = doc.querySelector('section[aria-label="Materiais disponíveis"]')!
    expect(downloads.querySelector('a')?.getAttribute('href')).toBe('/loja-a/item/local-file/abrir')
    expect(downloads.textContent).not.toContain('PDF do módulo B')
    expect(doc.querySelector('aside a[href="/loja-a/item/other-file"]')).not.toBeNull()
    expect([...doc.querySelectorAll('button[disabled]')].map((node) => node.textContent)).toContain('Conteúdo anterior')
  })

  it('inicia contexto e permissão antes de qualquer um terminar', async () => {
    const pendingContext = deferred<typeof context | null>()
    const pendingGranted = deferred<Map<string, 'basic' | 'complete'>>()
    vi.mocked(getItemWithContext).mockReturnValueOnce(pendingContext.promise)
    vi.mocked(loadGrantedProductLevels).mockReturnValueOnce(pendingGranted.promise)

    const rendering = ItemPage(itemProps())
    await settle()
    const callsBeforeResolution = [getItemWithContext, loadGrantedProductLevels].map((mock) => vi.mocked(mock).mock.calls.length)

    pendingContext.resolve(context)
    pendingGranted.resolve(new Map([[product.id, 'complete']]))
    await rendering

    expect(callsBeforeResolution).toEqual([1, 1])
  })

  it('prioriza 404 para conteúdo ausente, de outra loja ou oculto e nunca registra acesso', async () => {
    vi.mocked(loadGrantedProductLevels).mockResolvedValue(new Map())
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
    vi.mocked(loadGrantedProductLevels).mockResolvedValue(new Map())

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
    expect(html).toContain(product.title)
    expect(html).toContain('Acesse seu conteúdo')
    expect(html).toContain(`href="/${store.slug}/item/${file.id}/abrir"`)
    expect(html).not.toContain(file.url)
    expect(redirect).not.toHaveBeenCalled()
    expect(recordItemAccess).not.toHaveBeenCalled()
  })

  it.each(['arquivo', 'link'] as const)('mantém o layout completo para material único %s e enxuga os títulos genéricos', async (kind) => {
    const file = { ...item, title: 'Clique Aqui', kind, url: 'https://example.com/material' }
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ ...context, item: file, module: { ...courseModule, title: 'Clique aqui para acessar' } })
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, title: 'Clique Aqui para acessar seu Atlas', items: [file] }])
    const doc = await renderedItem()
    expect(doc.querySelector('h1')?.textContent).toBe(product.title)
    expect(doc.querySelector('.lesson-heading')?.textContent).not.toContain('Seu acesso:')
    expect(doc.querySelector('.lesson-heading')?.textContent?.split(product.title)).toHaveLength(2)
    expect(doc.body.textContent).not.toContain('Clique Aqui')
    expect(doc.body.textContent).not.toContain('Clique aqui para acessar')
    expect(doc.body.textContent).toContain('Precisa de ajuda?')
    expect(doc.querySelector('aside')).not.toBeNull()
    expect(doc.querySelector('aside')?.textContent).toContain('Materiais')
    expect(doc.querySelector('aside')?.textContent).toContain(product.title)
    expect(doc.body.textContent).not.toContain('Material principal')
    expect(doc.querySelector('.lesson-workspace-grid')?.className).toContain('lg:grid-cols-')
    const buttons = [...doc.querySelectorAll('button')].map((node) => node.textContent)
    for (const label of ['Concluir', 'Conteúdo anterior', 'Próximo conteúdo']) expect(buttons).toContain(label)
    const access = doc.querySelector(`a[href="/loja-a/item/${item.id}/abrir"]`)
    expect(access?.textContent).toContain('Acesse seu conteúdo')
    expect(access?.textContent).toContain(product.title)
    expect(access?.getAttribute('target')).toBe(kind === 'link' ? '_blank' : null)
    expect(recordItemAccess).not.toHaveBeenCalled()
  })

  it('mantém extras bloqueados e upgrade com o único arquivo acessível', async () => {
    const file = { ...item, kind: 'arquivo' as const, url: 'https://example.com/atlas.pdf' }
    const extra = { ...courseModule, id: 'extra', title: 'Projetos extras', requiredLevel: 'complete' as const, items: [{ ...file, id: 'private-id', title: 'Arquivo privado', url: 'https://example.com/secret.pdf' }] }
    vi.mocked(loadGrantedProductLevels).mockResolvedValueOnce(new Map([[product.id, 'basic']]))
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ ...context, item: file, product: { ...product, upgradeCheckoutUrl: 'https://example.com/upgrade' } })
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, items: [file] }, extra])
    const doc = await renderedItem()
    expect(doc.querySelector('h1')?.textContent).toBe(product.title)
    expect(doc.querySelector('aside')?.textContent).toContain(file.title)
    expect(doc.body.textContent).toContain('Projetos extras')
    expect(doc.querySelector('a[href="https://example.com/upgrade"]')).not.toBeNull()
    expect(doc.body.innerHTML).not.toContain('private-id')
    expect(doc.body.innerHTML).not.toContain('secret.pdf')
    expect(doc.body.textContent).not.toContain('Arquivo privado')
  })

  it('renderiza vídeo autorizado depois de registrar o acesso', async () => {
    const result = await ItemPage(itemProps())
    const html = renderToStaticMarkup(result)

    expect(loadStoreAccess).not.toHaveBeenCalled()
    expect(recordItemAccess).toHaveBeenCalledOnce()
    expect(html).toContain(item.title)
    expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('impede item extra direto antes de registro e não revela embed', async () => {
    const extra = { ...courseModule, requiredLevel: 'complete' as const }
    vi.mocked(loadGrantedProductLevels).mockResolvedValueOnce(new Map([[product.id, 'basic']]))
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ item, module: extra, product })
    await expect(ItemPage(itemProps())).rejects.toThrow('NEXT_REDIRECT:/loja-a/produto/produto-a?bloqueado=1')
    expect(recordItemAccess).not.toHaveBeenCalled()
    expect(listModulesWithItems).not.toHaveBeenCalled()
  })

  it('omite extras da barra lateral e da próxima aula para Básico', async () => {
    const extra = { ...courseModule, id: 'extra', title: 'Modelos exclusivos', requiredLevel: 'complete' as const }
    const extraItem = { ...item, id: '44444444-4444-4444-8444-444444444444', moduleId: extra.id, title: 'Aula secreta', url: 'https://www.youtube.com/watch?v=SecretVid01' }
    vi.mocked(loadGrantedProductLevels).mockResolvedValueOnce(new Map([[product.id, 'basic']]))
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, items: [item] }, { ...extra, items: [extraItem] }])
    const html = renderToStaticMarkup(await ItemPage(itemProps()))
    expect(html).not.toContain(extraItem.id)
    expect(html).not.toContain(extraItem.title)
    expect(html).not.toContain(extraItem.url)
    expect(html).toContain('Modelos exclusivos')
  })

  it('remove IDs de progresso de extras antigos antes de enviar dados ao sidebar de Básico', async () => {
    const extra = { ...courseModule, id: 'extra', requiredLevel: 'complete' as const }
    const extraItem = { ...item, id: '44444444-4444-4444-8444-444444444444', moduleId: extra.id }
    vi.mocked(loadGrantedProductLevels).mockResolvedValueOnce(new Map([[product.id, 'basic']]))
    vi.mocked(listCompletedItemIds).mockResolvedValueOnce([item.id, extraItem.id])
    vi.mocked(listModulesWithItems).mockResolvedValueOnce([{ ...courseModule, items: [item] }, { ...extra, items: [extraItem] }])

    function sidebarIds(node: ReactNode): string[] | null {
      if (!isValidElement(node)) return null
      if (node.type === LessonSidebar) return (node.props as { completedItemIds: string[] }).completedItemIds
      for (const child of Children.toArray((node.props as { children?: ReactNode }).children)) {
        const ids = sidebarIds(child)
        if (ids) return ids
      }
      return null
    }

    expect(sidebarIds(await ItemPage(itemProps()))).toEqual([item.id])
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
