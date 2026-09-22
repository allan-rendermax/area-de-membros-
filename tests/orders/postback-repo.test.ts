import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPostbackRepo } from '@/lib/data/postback-repo'

const { from, select, eq, contains, limit, insert, rpc, single } = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), contains: vi.fn(), limit: vi.fn(), insert: vi.fn(), rpc: vi.fn(), single: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from, rpc }) }))
vi.mock('@/lib/data/customers', () => ({ createCustomer: vi.fn(), findCustomerByEmail: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ findStoreForProductCode: vi.fn(), getProductsForCode: vi.fn() }))

beforeEach(() => {
  vi.resetAllMocks()
  from.mockReturnValue({ select, insert })
  select.mockReturnValue({ eq })
  eq.mockReturnValue({ eq, contains })
  contains.mockReturnValue({ limit })
})

describe('resultado efetivo do pedido', () => {
  const input = {
    storeId: 'store-1', transactionId: 'tx-1', productCode: 'ATLAS-COMPLETO', productName: 'Atlas',
    customerEmail: 'antigo@example.test', customerName: 'Nome Antigo', status: 'pago' as const,
    paytType: 'order', isTest: false, amountCents: 4700,
  }

  it('lê titular e status persistidos pelo ID devolvido pela RPC', async () => {
    rpc.mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {
      out_order_id: 'ord-1', out_changed: false, out_status: 'pago',
    }, error: null }) })
    from.mockImplementation((table) => table === 'orders' ? { select } : { insert })
    select.mockReturnValue({ eq })
    eq.mockReturnValue({ single })
    single.mockResolvedValue({ data: {
      id: 'ord-1', customer_email: 'corrigido@example.test', customer_name: 'Titular Corrigido', status: 'reembolsado',
    }, error: null })

    await expect(createPostbackRepo().applyOrderStatus(input)).resolves.toEqual({
      orderId: 'ord-1', changed: false, status: 'reembolsado',
      customerEmail: 'corrigido@example.test', customerName: 'Titular Corrigido',
    })
    expect(from).toHaveBeenCalledWith('orders')
    expect(select).toHaveBeenCalledWith('id, customer_email, customer_name, status')
    expect(eq).toHaveBeenCalledWith('id', 'ord-1')
  })

  it('propaga falha do SELECT e não devolve identidade do payload', async () => {
    rpc.mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {
      out_order_id: 'ord-1', out_changed: true, out_status: 'pago',
    }, error: null }) })
    from.mockReturnValue({ select })
    select.mockReturnValue({ eq })
    eq.mockReturnValue({ single })
    single.mockResolvedValue({ data: null, error: new Error('leitura indisponível') })

    await expect(createPostbackRepo().applyOrderStatus(input)).rejects.toThrow('leitura indisponível')
  })
})

describe('registro de avisos por cliente, loja e produtos', () => {
  it.each(['pendente', 'enviado', 'falhou'])('reconhece registro %s sem filtrar status', async (status) => {
    limit.mockResolvedValue({ data: [{ id: 'notice-1', status }], error: null })
    expect(await createPostbackRepo().hasNoticeForProducts('cus-1', 'store-1', ['product-1'])).toBe(true)
    expect(from).toHaveBeenCalledWith('email_log')
    expect(eq.mock.calls).toEqual([['customer_id', 'cus-1'], ['store_id', 'store-1']])
    expect(contains).toHaveBeenCalledWith('product_ids', ['product-1'])
    expect(limit).toHaveBeenCalledWith(1)
  })

  it('exige cobertura de cada produto mesmo quando registros diferentes formam a cobertura', async () => {
    limit.mockResolvedValueOnce({ data: [{ id: 'notice-1' }], error: null })
    limit.mockResolvedValueOnce({ data: [{ id: 'notice-2' }], error: null })
    const repo = createPostbackRepo()
    expect(await repo.hasNoticeForProducts('cus-1', 'store-1', ['product-1', 'product-2'])).toBe(true)
    expect(contains.mock.calls).toEqual([
      ['product_ids', ['product-1']],
      ['product_ids', ['product-2']],
    ])
    expect(limit).toHaveBeenCalledTimes(2)
  })

  it('retorna false com cobertura parcial e não trata lista vazia como coberta', async () => {
    limit.mockResolvedValueOnce({ data: [{ id: 'notice-1' }], error: null })
    limit.mockResolvedValueOnce({ data: [], error: null })
    const repo = createPostbackRepo()
    expect(await repo.hasNoticeForProducts('cus-1', 'store-1', ['product-1', 'product-2'])).toBe(false)

    vi.clearAllMocks()
    expect(await repo.hasNoticeForProducts('cus-1', 'store-1', [])).toBe(false)
    expect(from).not.toHaveBeenCalled()
  })

  it('propaga falha de consulta sem declarar os produtos cobertos', async () => {
    const error = new Error('consulta indisponível')
    limit.mockResolvedValue({ data: null, error })
    await expect(createPostbackRepo().hasNoticeForProducts('cus-1', 'store-1', ['product-1'])).rejects.toBe(error)
  })

  it('grava falhou com destinatário, tipo, erro e IDs conhecidos para o reenvio em lote', async () => {
    insert.mockResolvedValue({ error: null })
    await createPostbackRepo().logFailedNotice({
      storeId: 'store-1', customerId: 'cus-1', toEmail: 'joao@example.com', kind: 'produto_novo',
      productIds: ['product-1', 'product-2'], error: 'notify indisponível',
    })
    expect(from).toHaveBeenCalledWith('email_log')
    expect(insert).toHaveBeenCalledWith({
      store_id: 'store-1', customer_id: 'cus-1', to_email: 'joao@example.com', kind: 'produto_novo',
      product_ids: ['product-1', 'product-2'], status: 'falhou', error: 'notify indisponível',
    })
  })

  it('propaga falha de gravação para o processador decidir como tratá-la', async () => {
    const error = new Error('gravação indisponível')
    insert.mockResolvedValue({ error })
    await expect(createPostbackRepo().logFailedNotice({
      storeId: 'store-1', customerId: 'cus-1', toEmail: 'joao@example.com', kind: 'acesso_novo',
      productIds: [], error: 'falha original',
    })).rejects.toBe(error)
  })
})
