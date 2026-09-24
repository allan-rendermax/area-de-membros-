import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadGrantedProductIds, loadGrantedProductLevels, loadStoreAccess } from '@/lib/data/access'
import { findCustomerByEmail } from '@/lib/data/customers'
import { listAllOrderRefsByEmail } from '@/lib/data/orders'
import { getProductLinks, listProducts } from '@/lib/data/products'
import type { CustomerRow, Product } from '@/lib/domain/types'

vi.mock('@/lib/data/customers', () => ({ findCustomerByEmail: vi.fn() }))
vi.mock('@/lib/data/orders', () => ({ listAllOrderRefsByEmail: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ getProductLinks: vi.fn(), listProducts: vi.fn() }))

const customer: CustomerRow = {
  id: 'customer-a',
  email: 'aluna@example.com',
  name: 'Aluna',
  blockedAt: null,
}

const product: Product = {
  id: 'product-a',
  storeId: 'store-a',
  slug: 'produto-a',
  title: 'Produto A',
  track: 'Trilha',
  description: '',
  coverUrl: null,
  bannerUrl: null,
  checkoutUrl: null, role: 'front',
  isFeatured: false,
  sortOrder: 1,
  isPublished: true,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

describe('loadGrantedProductIds', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getProductLinks).mockResolvedValue([{ productCode: 'CODE', productId: product.id }])
    vi.mocked(listAllOrderRefsByEmail).mockResolvedValue([{ productCode: 'CODE', status: 'pago' }])
  })

  it('calcula a permissão atual sem buscar catálogo nem cliente novamente', async () => {
    expect(await loadGrantedProductIds('store-a', customer)).toEqual(new Set(['product-a']))

    expect(getProductLinks).toHaveBeenCalledWith('store-a')
    expect(listAllOrderRefsByEmail).toHaveBeenCalledWith(customer.email)
    expect(listProducts).not.toHaveBeenCalled()
    expect(findCustomerByEmail).not.toHaveBeenCalled()
  })

  it('inicia vínculos e pedidos em paralelo', async () => {
    const pendingLinks = deferred<{ productCode: string; productId: string }[]>()
    const pendingOrders = deferred<{ productCode: string; status: 'pago' }[]>()
    vi.mocked(getProductLinks).mockReturnValueOnce(pendingLinks.promise)
    vi.mocked(listAllOrderRefsByEmail).mockReturnValueOnce(pendingOrders.promise)

    const result = loadGrantedProductIds('store-a', customer)
    await Promise.resolve()
    const callsBeforeResolution = [getProductLinks, listAllOrderRefsByEmail]
      .map((mock) => vi.mocked(mock).mock.calls.length)

    pendingLinks.resolve([{ productCode: 'CODE', productId: product.id }])
    pendingOrders.resolve([{ productCode: 'CODE', status: 'pago' }])

    await expect(result).resolves.toEqual(new Set([product.id]))
    expect(callsBeforeResolution).toEqual([1, 1])
  })

  it('consulta pedidos em cada invocação para refletir reembolso', async () => {
    vi.mocked(listAllOrderRefsByEmail)
      .mockResolvedValueOnce([{ productCode: 'CODE', status: 'pago' }])
      .mockResolvedValueOnce([{ productCode: 'CODE', status: 'reembolsado' }])

    expect(await loadGrantedProductIds('store-a', customer)).toEqual(new Set(['product-a']))
    expect(await loadGrantedProductIds('store-a', customer)).toEqual(new Set())
    expect(listAllOrderRefsByEmail).toHaveBeenCalledTimes(2)
  })

  it('preserva acesso quando outra compra do mesmo código continua paga', async () => {
    vi.mocked(listAllOrderRefsByEmail).mockResolvedValueOnce([
      { productCode: 'CODE', status: 'reembolsado' },
      { productCode: 'CODE', status: 'pago' },
    ])

    expect(await loadGrantedProductIds('store-a', customer)).toEqual(new Set(['product-a']))
  })

  it('nega cliente bloqueado sem iniciar consultas de permissão', async () => {
    expect(await loadGrantedProductIds('store-a', { ...customer, blockedAt: '2026-09-22' })).toEqual(new Set())

    expect(getProductLinks).not.toHaveBeenCalled()
    expect(listAllOrderRefsByEmail).not.toHaveBeenCalled()
  })

  it('loads the current level and falls back to basic after complete refund', async () => {
    vi.mocked(getProductLinks).mockResolvedValue([
      { productCode: 'B', productId: product.id, grantLevel: 'basic' },
      { productCode: 'C', productId: product.id, grantLevel: 'complete' },
    ])
    vi.mocked(listAllOrderRefsByEmail).mockResolvedValue([
      { productCode: 'B', status: 'pago' },
      { productCode: 'C', status: 'reembolsado' },
    ])
    await expect(loadGrantedProductLevels('store-a', customer)).resolves.toEqual(new Map([[product.id, 'basic']]))
  })
})

describe('loadStoreAccess', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(listProducts).mockResolvedValue([product])
    vi.mocked(getProductLinks).mockResolvedValue([{ productCode: 'CODE', productId: product.id }])
    vi.mocked(listAllOrderRefsByEmail).mockResolvedValue([{ productCode: 'CODE', status: 'pago' }])
  })

  it('aceita cliente já carregado e preserva o retorno completo', async () => {
    await expect(loadStoreAccess('store-a', customer)).resolves.toEqual({
      customer,
      products: [product],
      granted: new Set(['product-a']),
      levels: new Map([['product-a', 'complete']]),
    })
    expect(findCustomerByEmail).not.toHaveBeenCalled()
  })

  it('mantém compatibilidade com chamadores que passam e-mail', async () => {
    vi.mocked(findCustomerByEmail).mockResolvedValue(customer)

    await expect(loadStoreAccess('store-a', customer.email)).resolves.toEqual({
      customer,
      products: [product],
      granted: new Set(['product-a']),
      levels: new Map([['product-a', 'complete']]),
    })
    expect(findCustomerByEmail).toHaveBeenCalledWith(customer.email)
  })

  it('mantém catálogo e acesso vazio para e-mail sem cliente', async () => {
    vi.mocked(findCustomerByEmail).mockResolvedValue(null)

    await expect(loadStoreAccess('store-a', 'desconhecida@example.com')).resolves.toEqual({
      customer: null,
      products: [product],
      granted: new Set(),
      levels: new Map(),
    })
  })
})
