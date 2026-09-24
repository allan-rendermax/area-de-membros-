import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listRecentMaterials } from '@/lib/data/item-access'
import { createAdminClient } from '@/lib/supabase/admin'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

const product = { id: 'p1', title: 'Produto', slug: 'produto', store_id: 's1', is_published: true }
const courseModule = { is_published: true, products: product }
const item = { id: 'i1', title: 'Aula', kind: 'video', url: 'https://youtu.be/abcdefghijk', is_published: true, modules: courseModule }

function query(rows: unknown[]) {
  const q = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }) }
  q.select.mockReturnValue(q); q.eq.mockReturnValue(q); q.order.mockReturnValue(q); q.limit.mockReturnValue(q)
  vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(q) } as never)
  return q
}

describe('materiais recentes autorizados', () => {
  beforeEach(() => vi.resetAllMocks())

  it('deduplica em ordem e exclui revogados, ocultos, inválidos e outra loja', async () => {
    const rows = [
      { items: item }, { items: item },
      { items: { ...item, id: 'revogado', modules: { ...courseModule, products: { ...product, id: 'p2' } } } },
      { items: { ...item, id: 'oculto', is_published: false } },
      { items: { ...item, id: 'sem-destino', kind: 'link', url: 'javascript:alert(1)' } },
      { items: { ...item, id: 'outra-loja', modules: { ...courseModule, products: { ...product, store_id: 's2' } } } },
    ]
    const q = query(rows)
    expect(await listRecentMaterials('c1', 's1', new Set(['p1']))).toEqual([{ itemId: 'i1', title: 'Aula', kind: 'video', productId: 'p1', productTitle: 'Produto', productSlug: 'produto' }])
    expect(q.limit).toHaveBeenCalledWith(expect.any(Number))
  })
})
