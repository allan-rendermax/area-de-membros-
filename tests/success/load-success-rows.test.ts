import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSuccessRows } from '@/lib/data/success'

const { rpc, range } = vi.hoisted(() => ({ rpc: vi.fn(), range: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc }) }))

const dbRow = (id: number) => ({
  customer_id: String(id),
  email: `cliente${id}@example.com`,
  first_paid_at: '2026-09-17T12:00:00Z',
  paid_orders: 2,
  last_seen_at: null,
  item_opens: 0,
  last_item_open_at: null,
})

beforeEach(() => {
  vi.resetAllMocks()
  rpc.mockReturnValue({ range })
})

describe('loadSuccessRows', () => {
  it('carrega além de mil clientes e preserva o mapeamento', async () => {
    range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => dbRow(i)), error: null })
      .mockResolvedValueOnce({ data: [dbRow(1000)], error: null })

    const rows = await loadSuccessRows('loja-1')

    expect(rows).toHaveLength(1001)
    expect(rows[1000]).toEqual({
      customerId: '1000', email: 'cliente1000@example.com', firstPaidAt: '2026-09-17T12:00:00Z',
      paidOrders: 2, lastSeenAt: null, itemOpens: 0, lastItemOpenAt: null,
    })
    expect(rpc.mock.calls).toEqual([
      ['store_customer_success', { p_store_id: 'loja-1' }],
      ['store_customer_success', { p_store_id: 'loja-1' }],
    ])
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999]])
  })

  it('encerra com lote vazio após um lote completo', async () => {
    range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => dbRow(i)), error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    expect(await loadSuccessRows('loja-1')).toHaveLength(1000)
    expect(range).toHaveBeenCalledTimes(2)
  })

  it('propaga o erro de um lote posterior sem retornar dados incompletos', async () => {
    const error = new Error('Falha na consulta')
    range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => dbRow(i)), error: null })
      .mockResolvedValueOnce({ data: null, error })

    await expect(loadSuccessRows('loja-1')).rejects.toBe(error)
  })
})
