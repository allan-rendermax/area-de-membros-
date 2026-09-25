import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getItemWithContext, getProductLinks, listModulesWithItems, listPublishedItemsInModule, toModule, toProduct } from '@/lib/data/products'

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
  role: 'upsell' as const,
  student_checkout_url: 'https://checkout.example.com/student?coupon=ALUNO10#payment',
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
  requiredLevel: 'basic',
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
  role: 'upsell',
  studentCheckoutUrl: productRow.student_checkout_url,
  isFeatured: false,
  sortOrder: 1,
  isPublished: true,
  upgradeCheckoutUrl: null, contentMode: 'sections', upgradeImageUrl: null, upgradeButtonText: null, purchaseTitle: null, purchaseDescription: null, purchaseImageUrl: null, purchaseButtonText: null,
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function useTransport(handle: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request)
    return handle(request)
  })
  admin.createAdminClient.mockImplementation(() => createClient('https://project.supabase.co', 'service-role-test', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  }))
  return requests
}

function useResponses(...responses: Response[]) {
  return useTransport(() => {
    const response = responses.shift()
    if (!response) throw new Error('Resposta HTTP falsa não configurada')
    return response
  })
}

function useItemsTable(rows: Record<string, unknown>[]) {
  return useTransport((request) => {
    const url = new URL(request.url)
    const filtered = [...rows]

    for (const [column, expression] of url.searchParams) {
      if (column === 'select' || column === 'order' || !expression.startsWith('eq.')) continue
      const expected = expression.slice(3)
      for (let index = filtered.length - 1; index >= 0; index -= 1) {
        if (String(filtered[index][column]) !== expected) filtered.splice(index, 1)
      }
    }

    const ordering = url.searchParams.get('order')?.split(',') ?? []
    filtered.sort((left, right) => {
      for (const clause of ordering) {
        const [column, direction = 'asc'] = clause.split('.')
        const comparison = String(left[column]).localeCompare(String(right[column]), undefined, { numeric: true })
        if (comparison !== 0) return direction === 'desc' ? -comparison : comparison
      }
      return 0
    })

    return json(filtered)
  })
}

function useModulesTable() {
  const rows = [
    {
      ...moduleRow, id: 'module-b', title: 'Módulo B', sort_order: 2,
      created_at: '2026-09-22T11:00:00Z', items: [],
    },
    {
      ...moduleRow, id: 'module-hidden', title: 'Rascunho', sort_order: 0,
      is_published: false, created_at: '2026-09-22T08:00:00Z',
      items: [{ ...firstRow, module_id: 'module-hidden', id: 'item-draft', created_at: '2026-09-22T08:00:00Z' }],
    },
    {
      ...moduleRow, created_at: '2026-09-22T10:00:00Z',
      items: [
        { ...secondRow, created_at: '2026-09-22T11:00:00Z' },
        { ...firstRow, id: 'item-hidden', is_published: false, created_at: '2026-09-22T09:00:00Z' },
        { ...firstRow, created_at: '2026-09-22T10:00:00Z' },
      ],
    },
  ]
  const requests = useTransport((request) => {
    const url = new URL(request.url)
    const order = (entries: typeof rows) => entries.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    const modules = rows
      .filter((row) => url.searchParams.get('product_id') === `eq.${row.product_id}`)
      .filter((row) => url.searchParams.get('is_published') !== 'eq.true' || row.is_published)
      .map((row) => ({
        ...row,
        items: row.items
          .filter((child) => url.searchParams.get('items.is_published') !== 'eq.true' || child.is_published)
          .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
      }))
    if (url.searchParams.get('order') === 'sort_order.asc,created_at.asc') order(modules)
    return json(modules)
  })
  return requests
}

describe('consultas de conteúdo', () => {
  beforeEach(() => {
    admin.createAdminClient.mockReset()
  })

  it('maps level and upgrade fields while defaulting legacy rows', () => {
    expect(toProduct({ ...productRow, upgrade_checkout_url: 'https://pay.example/upgrade' }).upgradeCheckoutUrl).toBe('https://pay.example/upgrade')
    expect(toProduct(productRow).upgradeCheckoutUrl).toBeNull()
    expect(toModule({ ...moduleRow, required_level: 'complete' }).requiredLevel).toBe('complete')
    expect(toModule(moduleRow).requiredLevel).toBe('basic')
  })

  it('reads grant levels from offer links and defaults legacy rows to complete', async () => {
    const requests = useResponses(json([
      { payt_product_code: 'B', offer_products: [{ product_id: 'P', grant_level: 'basic' }] },
      { payt_product_code: 'OLD', offer_products: [{ product_id: 'L' }] },
    ]))
    await expect(getProductLinks('store-a')).resolves.toEqual([
      { productCode: 'B', productId: 'P', grantLevel: 'basic' },
      { productCode: 'OLD', productId: 'L', grantLevel: 'complete' },
    ])
    expect(new URL(requests[0].url).searchParams.get('select')).toContain('grant_level')
  })

  it('carrega módulos e itens publicados ordenados em uma consulta relacional', async () => {
    const requests = useModulesTable()

    await expect(listModulesWithItems(productRow.id, { publishedOnly: true })).resolves.toEqual([
      { ...parent, items: [item, { ...item, id: secondRow.id, title: secondRow.title, url: secondRow.url, sortOrder: 2 }] },
      { ...parent, id: 'module-b', title: 'Módulo B', sortOrder: 2, items: [] },
    ])

    expect(requests).toHaveLength(1)
    const url = new URL(requests[0].url)
    expect(url.pathname).toBe('/rest/v1/modules')
    expect(url.searchParams.get('select')).toContain('items(')
    expect(url.searchParams.get('product_id')).toBe(`eq.${productRow.id}`)
    expect(url.searchParams.get('is_published')).toBe('eq.true')
    expect(url.searchParams.get('items.is_published')).toBe('eq.true')
    expect(url.searchParams.get('order')).toBe('sort_order.asc,created_at.asc')
    expect(url.searchParams.get('items.order')).toBe('sort_order.asc,created_at.asc')
  })

  it('inclui rascunhos e módulos vazios no modo admin sem filtros publicados', async () => {
    const requests = useModulesTable()

    const modules = await listModulesWithItems(productRow.id, { publishedOnly: false })
    expect(modules.map((module) => [module.id, module.items.map((child) => child.id)])).toEqual([
      ['module-hidden', ['item-draft']],
      ['module-a', ['item-hidden', 'item-first', 'item-second']],
      ['module-b', []],
    ])
    expect(requests).toHaveLength(1)
    const url = new URL(requests[0].url)
    expect(url.searchParams.has('is_published')).toBe(false)
    expect(url.searchParams.has('items.is_published')).toBe(false)
  })

  it('propaga erro da consulta relacional de módulos', async () => {
    const requests = useResponses(json({ message: 'módulos indisponíveis', code: 'XX002', details: null, hint: null }, 500))

    await expect(listModulesWithItems(productRow.id, { publishedOnly: true }))
      .rejects.toMatchObject({ message: 'módulos indisponíveis', code: 'XX002' })
    expect(requests).toHaveLength(1)
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
    expect(url.searchParams.get('select')).toContain('role')
    expect(url.searchParams.get('select')).toContain('student_checkout_url')
    expect(url.searchParams.get('select')).toContain('role')
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
    const requests = useItemsTable([
      { ...secondRow, created_at: '2026-09-22T11:00:00Z' },
      {
        ...firstRow,
        id: 'item-hidden',
        title: 'Aula oculta',
        is_published: false,
        created_at: '2026-09-22T09:00:00Z',
      },
      {
        ...firstRow,
        id: 'item-other-module',
        module_id: 'module-b',
        title: 'Aula de outro módulo',
        created_at: '2026-09-22T08:00:00Z',
      },
      { ...firstRow, created_at: '2026-09-22T10:00:00Z' },
    ])

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
    const requests = useItemsTable([
      { ...firstRow, created_at: '2026-09-22T10:00:00Z' },
      { ...secondRow, module_id: 'module-b', created_at: '2026-09-22T11:00:00Z' },
    ])

    await expect(listPublishedItemsInModule('module-empty')).resolves.toEqual([])
    expect(new URL(requests[0].url).searchParams.get('module_id')).toBe('eq.module-empty')
  })

  it('propaga erro da consulta de irmãos', async () => {
    useResponses(json({ message: 'irmãos indisponíveis', code: 'XX001', details: null, hint: null }, 500))

    await expect(listPublishedItemsInModule(moduleRow.id)).rejects.toMatchObject({ message: 'irmãos indisponíveis', code: 'XX001' })
  })
})
