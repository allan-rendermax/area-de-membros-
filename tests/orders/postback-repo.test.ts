import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPostbackRepo } from '@/lib/data/postback-repo'

const { from, select, eq, limit, insert } = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), limit: vi.fn(), insert: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))
vi.mock('@/lib/data/customers', () => ({ createCustomer: vi.fn(), findCustomerByEmail: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ findStoreForProductCode: vi.fn(), getProductsForCode: vi.fn() }))

beforeEach(() => {
  vi.resetAllMocks()
  from.mockReturnValue({ select, insert })
  select.mockReturnValue({ eq })
  eq.mockReturnValue({ eq, limit })
})

describe('registro de avisos por cliente e loja', () => {
  it.each(['pendente', 'enviado', 'falhou'])('reconhece registro %s sem filtrar status', async (status) => {
    limit.mockResolvedValue({ data: [{ id: 'notice-1', status }], error: null })
    expect(await createPostbackRepo().hasNoticeForStore('cus-1', 'store-1')).toBe(true)
    expect(from).toHaveBeenCalledWith('email_log')
    expect(eq.mock.calls).toEqual([['customer_id', 'cus-1'], ['store_id', 'store-1']])
    expect(limit).toHaveBeenCalledWith(1)
  })

  it('retorna false sem registro e propaga falha de consulta', async () => {
    limit.mockResolvedValueOnce({ data: [], error: null })
    const repo = createPostbackRepo()
    expect(await repo.hasNoticeForStore('cus-1', 'store-1')).toBe(false)
    const error = new Error('consulta indisponível')
    limit.mockResolvedValueOnce({ data: null, error })
    await expect(repo.hasNoticeForStore('cus-1', 'store-1')).rejects.toBe(error)
  })

  it('grava falhou com destinatário, tipo, erro e produtos vazios para o reenvio em lote', async () => {
    insert.mockResolvedValue({ error: null })
    await createPostbackRepo().logFailedNotice({
      storeId: 'store-1', customerId: 'cus-1', toEmail: 'joao@example.com', kind: 'produto_novo', error: 'notify indisponível',
    })
    expect(from).toHaveBeenCalledWith('email_log')
    expect(insert).toHaveBeenCalledWith({
      store_id: 'store-1', customer_id: 'cus-1', to_email: 'joao@example.com', kind: 'produto_novo',
      product_ids: [], status: 'falhou', error: 'notify indisponível',
    })
  })

  it('propaga falha de gravação para o processador decidir como tratá-la', async () => {
    const error = new Error('gravação indisponível')
    insert.mockResolvedValue({ error })
    await expect(createPostbackRepo().logFailedNotice({
      storeId: 'store-1', customerId: 'cus-1', toEmail: 'joao@example.com', kind: 'acesso_novo', error: 'falha original',
    })).rejects.toBe(error)
  })
})
