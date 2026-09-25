import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Home from '@/app/[loja]/page'
import ProductPage from '@/app/[loja]/produto/[slug]/page'
import ItemPage from '@/app/[loja]/item/[id]/page'
import { GET as openResource } from '@/app/[loja]/item/[id]/abrir/route'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getStore, requireStoreSession } from '@/lib/membros/session'
import { listProducts, getProductBySlug, getItemWithContext, listModulesWithItems } from '@/lib/data/products'
import { loadStoreAccess, loadGrantedProductLevels } from '@/lib/data/access'
import { listRecentProductIds, recordItemAccess } from '@/lib/data/item-access'
import { listCompletedItemIds } from '@/lib/data/member-progress'
import { StoreHeader } from '@/components/membros/store-header'
import type { Product, Item, Store, ModuleWithItems } from '@/lib/domain/types'

vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`) },
  notFound: () => { throw new Error('notFound') },
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@/app/[loja]/progresso/actions', () => ({ saveCompletion: vi.fn() }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/membros/session', () => ({ requireStoreSession: vi.fn(), getStore: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ listProducts: vi.fn(), getProductBySlug: vi.fn(), getItemWithContext: vi.fn(), listModulesWithItems: vi.fn() }))
vi.mock('@/lib/data/access', () => ({ loadStoreAccess: vi.fn(), loadGrantedProductLevels: vi.fn() }))
vi.mock('@/lib/data/item-access', () => ({ listRecentProductIds: vi.fn(), recordItemAccess: vi.fn() }))
vi.mock('@/lib/data/member-progress', () => ({ listCompletedItemIds: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: { supabaseUrl: 'https://project.supabase.co' } }))

const store: Store = { id: 'store', slug: 'arquitetura', name: 'Arquitetura', logoUrl: null, supportUrl: null, supportWhatsapp: null, loginImageUrl: null }
const product: Product = { id: 'product', storeId: store.id, slug: 'rascunho', title: 'Produto em criação', description: '', track: '', coverUrl: null, bannerUrl: null, checkoutUrl: null, role: 'front', sortOrder: 0, isFeatured: true, isPublished: false }
const item: Item = { id: '11111111-1111-4111-8111-111111111111', moduleId: 'module', title: 'Aula em criação', kind: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', coverUrl: null, sortOrder: 0, isPublished: false }
const moduleRow: ModuleWithItems = { id: 'module', productId: product.id, title: 'Módulo em criação', sortOrder: 0, isPublished: false, requiredLevel: 'complete', items: [item] }
const params = Promise.resolve({ loja: store.slug, slug: product.slug, id: item.id })
const searchParams = Promise.resolve({ previa: '1' })
const props = { params, searchParams }
const request = new Request(`https://app.example/${store.slug}/item/${item.id}/abrir?previa=1`)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(requireAdmin).mockResolvedValue({ email: 'admin@example.com' })
  vi.mocked(requireStoreSession).mockRejectedValue(new Error('student login required'))
  vi.mocked(getStore).mockResolvedValue(store)
  vi.mocked(listProducts).mockResolvedValue([product])
  vi.mocked(getProductBySlug).mockResolvedValue(product)
  vi.mocked(getItemWithContext).mockResolvedValue({ item, module: moduleRow, product })
  vi.mocked(listModulesWithItems).mockResolvedValue([moduleRow])
})

describe('prévia administrativa sem conta de aluno', () => {
  it('abre a vitrine e produtos em rascunho sem consultar compras de aluno', async () => {
    const html = renderToStaticMarkup(await Home(props))
    expect(html).toContain('Modo de prévia')
    expect(html).toContain('Produto em criação')
    expect(html).toContain('/arquitetura/produto/rascunho?previa=1')
    expect(loadStoreAccess).not.toHaveBeenCalled()
    expect(listRecentProductIds).not.toHaveBeenCalled()
    expect(requireStoreSession).not.toHaveBeenCalled()
  })

  it('inclui módulos e aulas em rascunho mantendo a navegação na prévia', async () => {
    await expect(ProductPage(props)).rejects.toThrow(`redirect:/arquitetura/item/${item.id}?previa=1`)
    const html = renderToStaticMarkup(await ItemPage(props))
    expect(html).toContain('Módulo em criação')
    expect(html).toContain('Aula em criação')
    expect(html).toContain(`/arquitetura/item/${item.id}?previa=1`)
    expect(html).toContain('href="/arquitetura?previa=1"')
    expect(listModulesWithItems).toHaveBeenCalledWith(product.id, { publishedOnly: false })
    expect(loadGrantedProductLevels).not.toHaveBeenCalled()
  })

  it('abre aula sem registrar acesso ou carregar progresso e desabilita conclusão', async () => {
    const html = renderToStaticMarkup(await ItemPage(props))
    expect(html).toContain('Aula em criação')
    expect(html).toContain('youtube-nocookie.com/embed/')
    expect(html).toContain('Progresso desativado na prévia')
    expect(recordItemAccess).not.toHaveBeenCalled()
    expect(listCompletedItemIds).not.toHaveBeenCalled()
  })

  it.each([Home, ProductPage, ItemPage])('recusa prévia sem admin antes de carregar conteúdo', async (page) => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('redirect:/admin/entrar'))
    await expect(page(props)).rejects.toThrow('redirect:/admin/entrar')
    expect(listProducts).not.toHaveBeenCalled()
    expect(getProductBySlug).not.toHaveBeenCalled()
    expect(getItemWithContext).not.toHaveBeenCalled()
  })

  it('abre recurso em rascunho sem registrar download', async () => {
    vi.mocked(getItemWithContext).mockResolvedValue({ item: { ...item, kind: 'link', url: 'https://example.com/material' }, module: moduleRow, product })
    await expect(openResource(request, { params })).rejects.toThrow('redirect:https://example.com/material')
    expect(recordItemAccess).not.toHaveBeenCalled()
  })

  it('mantém os links de arquivos e de próxima aula dentro da prévia', async () => {
    const file = { ...item, id: '22222222-2222-4222-8222-222222222222', kind: 'arquivo' as const, title: 'Arquivo em criação', url: 'https://example.com/material.pdf' }
    vi.mocked(listModulesWithItems).mockResolvedValue([{ ...moduleRow, items: [item, file] }])
    const html = renderToStaticMarkup(await ItemPage(props))
    expect(html).toContain(`/arquitetura/item/${file.id}/abrir?previa=1`)
    expect(html).toContain(`/arquitetura/item/${file.id}?previa=1`)
    expect(html).toContain('Arquivo em criação')
  })

  it('não permite abrir recurso da prévia sem admin', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('redirect:/admin/entrar'))
    await expect(openResource(request, { params })).rejects.toThrow('redirect:/admin/entrar')
    expect(getItemWithContext).not.toHaveBeenCalled()
  })

  it('não abre item de outra loja mesmo na prévia', async () => {
    vi.mocked(getItemWithContext).mockResolvedValue({ item, module: moduleRow, product: { ...product, storeId: 'other' } })
    await expect(ItemPage(props)).rejects.toThrow('notFound')
    await expect(openResource(request, { params })).rejects.toThrow('notFound')
  })

  it('mantém a exigência de aluno fora da prévia', async () => {
    await expect(Home({ params, searchParams: Promise.resolve({}) })).rejects.toThrow('student login required')
    expect(requireAdmin).not.toHaveBeenCalled()
  })

  it('cabeçalho da prévia volta ao painel em vez de encerrar alguma sessão', () => {
    const html = renderToStaticMarkup(createElement(StoreHeader, { store, email: '', preview: true }))
    expect(html).toContain('Voltar ao painel')
    expect(html).not.toContain('/sair')
    expect(html).toContain('/arquitetura?previa=1#materiais')
  })
})
