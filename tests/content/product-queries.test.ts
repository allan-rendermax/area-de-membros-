import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getItemWithContext, listPublishedItemsInModule } from '@/lib/data/products'

const admin = vi.hoisted(() => ({ createAdminClient: vi.fn() }))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: admin.createAdminClient }))

const productRow = {
  id: 'product-a',
  store_id: 'store-a',
  slug: 'produto-a',
  title: 'Produto A',
  track: 'Trilha',
  description: 'Descrição',
  cover_url: null,
  banner_url: null,
  checkout_url: 'https://checkout.example.com',
  is_featured: false,
  sort_order: 1,
  is_published: true,
}

const moduleRow = {
  id: 'module-a',
  product_id: productRow.id,
  title: 'Módulo A',
  sort_order: 1,
  is_published: true,
}

const firstRow = {
  id: 'item-first',
  module_id: moduleRow.id,
  title: 'Primeira aula',
  kind: 'video' as const,
  url: 'https://video.example.com/first',
  cover_url: null,
  sort_order: 1,
  is_published: true,
}

const secondRow = {
  ...firstRow,
  id: 'item-second',
  title: 'Segunda aula',
  url: 'https://video.example.com/second',
  sort_order: 2,
}

const item = {
  id: firstRow.id,
  moduleId: moduleRow.id,
  title: firstRow.title,
  kind: firstRow.kind,
  url: firstRow.url,
  coverUrl: null,
  sortOrder: 1,
  isPublished: true,
}

const parent = {
  id: moduleRow.id,
  productId: productRow.id,
  title: moduleRow.title,
  sortOrder: 1,
  isPublished: true,
}

const product = {
  id: productRow.id,
  storeId: productRow.store_id,
  slug: productRow.slug,
  title: productRow.title,
  track: productRow.track,
  description: productRow.description,
  coverUrl: null,
  bannerUrl: null,
  checkoutUrl: productRow.checkout_url,
  isFeatured: false,
  sortOrder: 1,
  isPublished: true,
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function useResponses(...responses: Response[]) {
  const requests: Request[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init))
    const response = responses.shift()
    if (!response) throw new Error('Resposta HTTP falsa não configurada')
    return response
  })
  admin.createAdminClient.mockImplementation(() => createClient('https://project.supabase.co', 'service-role-test', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  }))
  return requests
}

describe('consultas de conteúdo', () => {
  beforeEach(() => {
    admin.createAdminClient.mockReset()
  })

  it('carrega item, módulo e produto em uma única requisição relacional', async () => {
    const requests = useResponses(
      json({ ...firstRow, modules: { ...moduleRow, products: productRow } }),
      json(moduleRow),
      json(productRow),
    )

    await expect(getItemWithContext(firstRow.id)).resolves.toEqual({ item, module: parent, product })

    expect(requests).toHaveLength(1)
    const url = new URL(requests[0].url)
    expect(url.pathname).toBe('/rest/v1/items')
    expect(url.searchParams.get('id')).toBe(`eq.${firstRow.id}`)
    expect(url.searchParams.get('select')).toContain('modules(')
    expect(url.searchParams.get('select')).toContain('products(')
  })

  it.each([
    ['módulo ausente', null],
    ['produto ausente', { ...moduleRow, products: null }],
  ])('retorna null quando o pai relacional está ausente: %s', async (_case, modules) => {
    const requests = useResponses(json({ ...firstRow, modules }), json(moduleRow), json(productRow))

    await expect(getItemWithContext(firstRow.id)).resolves.toBeNull()
    expect(requests).toHaveLength(1)
  })

  it('propaga erro da consulta relacional', async () => {
    useResponses(json({ message: 'contexto indisponível', code: 'XX000', details: null, hint: null }, 500))

    await expect(getItemWithContext(firstRow.id)).rejects.toMatchObject({ message: 'contexto indisponível', code: 'XX000' })
  })

  it('busca somente irmãos publicados do módulo na ordem estável', async () => {
    const requests = useResponses(json([firstRow, secondRow]))

    await expect(listPublishedItemsInModule(moduleRow.id)).resolves.toEqual([
      item,
      { ...item, id: secondRow.id, title: secondRow.title, url: secondRow.url, sortOrder: 2 },
    ])

    expect(requests).toHaveLength(1)
    const url = new URL(requests[0].url)
    expect(url.pathname).toBe('/rest/v1/items')
    expect(url.searchParams.get('module_id')).toBe(`eq.${moduleRow.id}`)
    expect(url.searchParams.get('is_published')).toBe('eq.true')
    expect(url.searchParams.get('order')).toBe('sort_order.asc,created_at.asc')
  })

  it('retorna vazio para módulo sem itens publicados', async () => {
    const requests = useResponses(json([]))

    await expect(listPublishedItemsInModule('module-empty')).resolves.toEqual([])
    expect(new URL(requests[0].url).searchParams.get('module_id')).toBe('eq.module-empty')
  })

  it('propaga erro da consulta de irmãos', async () => {
    useResponses(json({ message: 'irmãos indisponíveis', code: 'XX001', details: null, hint: null }, 500))

    await expect(listPublishedItemsInModule(moduleRow.id)).rejects.toMatchObject({ message: 'irmãos indisponíveis', code: 'XX001' })
  })
})
