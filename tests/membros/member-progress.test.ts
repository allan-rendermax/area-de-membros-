import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listCompletedItemIds, setItemCompletion } from '@/lib/data/member-progress'
import { createAdminClient } from '@/lib/supabase/admin'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

const entry = { customerId: 'c1', storeId: 's1', productId: 'p1', itemId: 'i1', completed: true }

describe('persistência de conclusão', () => {
  beforeEach(() => vi.resetAllMocks())

  it('filtra leitura por cliente, loja e produto', async () => {
    const q = { select: vi.fn(), eq: vi.fn(), then: (resolve: (v: unknown) => void) => resolve({ data: [{ item_id: 'i1' }], error: null }) }
    q.select.mockReturnValue(q); q.eq.mockReturnValue(q)
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(q) } as never)
    expect(await listCompletedItemIds('c1', 's1', 'p1')).toEqual(['i1'])
    expect(q.eq.mock.calls).toEqual([['customer_id', 'c1'], ['store_id', 's1'], ['product_id', 'p1']])
  })

  it('grava conclusão e remove ao desfazer, propagando falhas', async () => {
    const terminal = { error: null }
    const q = { upsert: vi.fn().mockResolvedValue(terminal), delete: vi.fn(), eq: vi.fn() }
    q.delete.mockReturnValue(q); q.eq.mockReturnValue(q)
    Object.assign(q, { then: (resolve: (v: unknown) => void) => resolve(terminal) })
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(q) } as never)
    await setItemCompletion(entry)
    expect(q.upsert).toHaveBeenCalledWith(expect.objectContaining({ customer_id: 'c1', store_id: 's1', item_id: 'i1', product_id: 'p1' }), expect.any(Object))
    await setItemCompletion({ ...entry, completed: false })
    expect(q.delete).toHaveBeenCalled()
    expect(q.eq.mock.calls).toEqual([['customer_id', 'c1'], ['store_id', 's1'], ['item_id', 'i1']])
    q.upsert.mockResolvedValueOnce({ error: new Error('DB unavailable') })
    await expect(setItemCompletion(entry)).rejects.toThrow('DB unavailable')
  })
})
