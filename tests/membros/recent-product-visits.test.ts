import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listRecentProductVisits } from '@/lib/data/item-access'
import { createAdminClient } from '@/lib/supabase/admin'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
const product = { id: 'p1', store_id: 's1', is_published: true }
const moduleRow = { required_level: 'basic', is_published: true, products: product }
const item = { id: 'i1', kind: 'link', url: 'https://example.com/file', is_published: true, modules: moduleRow }
const visit = { product_id: 'p1', item_id: 'i1', created_at: '2026-09-25T10:00:00Z', items: item }
function query(rows: unknown[]) {
  const q = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(), order: vi.fn(), limit: vi.fn(), then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }) }
  for (const method of [q.select, q.eq, q.gte, q.order, q.limit]) method.mockReturnValue(q)
  const from = vi.fn().mockReturnValue(q)
  vi.mocked(createAdminClient).mockReturnValue({ from } as never)
  return { q, from }
}
describe('histórico em lote para retomada', () => {
  beforeEach(() => vi.resetAllMocks())
  it('traz visitas em ordem e nível atual em uma consulta delimitada por cliente e loja', async () => {
    const { q, from } = query([visit, { ...visit, item_id: 'i2', items: { ...item, id: 'i2' } }])
    expect(await listRecentProductVisits('c1', 's1')).toEqual([
      { productId: 'p1', itemId: 'i1', accessedAt: visit.created_at, availableItem: { requiredLevel: 'basic' } },
      { productId: 'p1', itemId: 'i2', accessedAt: visit.created_at, availableItem: { requiredLevel: 'basic' } },
    ])
    expect(from).toHaveBeenCalledExactlyOnceWith('item_access')
    expect(q.eq.mock.calls).toEqual([['customer_id', 'c1'], ['store_id', 's1']])
    expect(q.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(q.gte).toHaveBeenCalledWith('created_at', expect.any(String))
    expect(q.limit).toHaveBeenCalledWith(200)
  })
  it.each([
    null,
    { ...item, is_published: false },
    { ...item, url: 'javascript:alert(1)' },
    { ...item, kind: 'video', url: 'https://example.com/unsupported-video' },
    { ...item, modules: { ...moduleRow, is_published: false } },
    { ...item, modules: { ...moduleRow, products: { ...product, is_published: false } } },
    { ...item, modules: { ...moduleRow, products: { ...product, store_id: 'other-store' } } },
    { ...item, modules: { ...moduleRow, products: { ...product, id: 'other-product' } } },
  ])('mantém produto para fallback sem liberar item removido, oculto, inválido ou movido', async (invalid) => {
    query([{ ...visit, items: invalid }])
    expect(await listRecentProductVisits('c1', 's1')).toEqual([{ productId: 'p1', itemId: 'i1', accessedAt: visit.created_at, availableItem: null }])
  })
})
