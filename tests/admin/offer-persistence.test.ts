import { Children, isValidElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OfferForm } from '@/app/admin/(painel)/ofertas/offer-form'
import type { OfferInput } from '@/lib/admin/forms'
import { saveOffer } from '@/lib/data/products-admin'
import type { AdminOffer } from '@/lib/data/products-admin'
import type { Product } from '@/lib/domain/types'

const mocks = vi.hoisted(() => ({
  state: {
    offerLookup: { data: { payt_product_code: 'OLD' }, error: null as Error | null },
  },
  from: vi.fn(),
  offerSelect: vi.fn(),
  offerReadIdEq: vi.fn(),
  offerReadStoreEq: vi.fn(),
  offerMaybeSingle: vi.fn(),
  offerUpdate: vi.fn(),
  offerUpdateIdEq: vi.fn(),
  offerUpdateStoreEq: vi.fn(),
  offerUpdateSelect: vi.fn(),
  offerInsert: vi.fn(),
  offerInsertSelect: vi.fn(),
  offerInsertSingle: vi.fn(),
  productSelect: vi.fn(),
  productStoreEq: vi.fn(),
  productIn: vi.fn(),
  offerProductsUpsert: vi.fn(),
  offerProductsDelete: vi.fn(),
  offerProductsDeleteEq: vi.fn(),
  offerProductsNot: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from }) }))
vi.mock('@/app/admin/(painel)/ofertas/actions', () => ({ salvarOferta: vi.fn() }))

const baseInput: OfferInput = {
  id: 'existing',
  storeId: 'store-1',
  name: 'Oferta atualizada',
  paytProductCode: 'OLD',
  productIds: ['product-1'],
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.state.offerLookup = { data: { payt_product_code: 'OLD' }, error: null }

  mocks.offerSelect.mockReturnValue({ eq: mocks.offerReadIdEq })
  mocks.offerReadIdEq.mockReturnValue({ eq: mocks.offerReadStoreEq })
  mocks.offerReadStoreEq.mockReturnValue({ maybeSingle: mocks.offerMaybeSingle })
  mocks.offerMaybeSingle.mockImplementation(async () => mocks.state.offerLookup)

  mocks.offerUpdate.mockReturnValue({ eq: mocks.offerUpdateIdEq })
  mocks.offerUpdateIdEq.mockReturnValue({ eq: mocks.offerUpdateStoreEq })
  mocks.offerUpdateStoreEq.mockReturnValue({ select: mocks.offerUpdateSelect })
  mocks.offerUpdateSelect.mockResolvedValue({ data: [{ id: 'existing' }], error: null })

  mocks.offerInsert.mockReturnValue({ select: mocks.offerInsertSelect })
  mocks.offerInsertSelect.mockReturnValue({ single: mocks.offerInsertSingle })
  mocks.offerInsertSingle.mockResolvedValue({ data: { id: 'created' }, error: null })

  mocks.productSelect.mockReturnValue({ eq: mocks.productStoreEq })
  mocks.productStoreEq.mockReturnValue({ in: mocks.productIn })
  mocks.productIn.mockResolvedValue({ count: 1, error: null })

  mocks.offerProductsUpsert.mockResolvedValue({ error: null })
  mocks.offerProductsDelete.mockReturnValue({ eq: mocks.offerProductsDeleteEq })
  mocks.offerProductsDeleteEq.mockReturnValue({ not: mocks.offerProductsNot })
  mocks.offerProductsNot.mockResolvedValue({ error: null })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'offers') return { select: mocks.offerSelect, update: mocks.offerUpdate, insert: mocks.offerInsert }
    if (table === 'products') return { select: mocks.productSelect }
    if (table === 'offer_products') return { upsert: mocks.offerProductsUpsert, delete: mocks.offerProductsDelete }
    throw new Error(`Tabela inesperada no teste: ${table}`)
  })
})

function expectNoWrites(): void {
  expect(mocks.offerUpdate).not.toHaveBeenCalled()
  expect(mocks.offerInsert).not.toHaveBeenCalled()
  expect(mocks.offerProductsUpsert).not.toHaveBeenCalled()
  expect(mocks.offerProductsDelete).not.toHaveBeenCalled()
}

describe('persistência de ofertas', () => {
  it('recusa mudar o código de uma oferta existente antes de qualquer escrita', async () => {
    await expect(saveOffer({ ...baseInput, paytProductCode: 'NEW', productIds: [] })).rejects.toThrow('código')

    expect(mocks.offerSelect).toHaveBeenCalledWith('payt_product_code')
    expect(mocks.offerReadIdEq).toHaveBeenCalledWith('id', 'existing')
    expect(mocks.offerReadStoreEq).toHaveBeenCalledWith('store_id', 'store-1')
    expectNoWrites()
  })

  it('permite editar nome e produtos quando o código permanece igual sem reenviar o código no update', async () => {
    await expect(saveOffer(baseInput)).resolves.toBeUndefined()

    expect(mocks.offerUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Oferta atualizada' }))
    expect(mocks.offerUpdate.mock.calls[0][0]).not.toHaveProperty('payt_product_code')
    expect(mocks.offerProductsUpsert).toHaveBeenCalledWith(
      [{ offer_id: 'existing', product_id: 'product-1' }],
      { onConflict: 'offer_id,product_id', ignoreDuplicates: true },
    )
    expect(mocks.offerProductsDelete).toHaveBeenCalled()
  })

  it('mantém a criação de oferta com o código informado', async () => {
    await expect(saveOffer({ ...baseInput, id: null, paytProductCode: 'NEW' })).resolves.toBeUndefined()

    expect(mocks.offerSelect).not.toHaveBeenCalled()
    expect(mocks.offerInsert).toHaveBeenCalledWith({ store_id: 'store-1', name: 'Oferta atualizada', payt_product_code: 'NEW' })
  })

  it('recusa id ausente antes de qualquer escrita', async () => {
    mocks.state.offerLookup = { data: null as never, error: null }

    await expect(saveOffer({ ...baseInput, productIds: [] })).rejects.toThrow('Oferta não encontrada')

    expectNoWrites()
  })

  it('propaga falha da leitura antes de qualquer escrita', async () => {
    const failure = new Error('falha ao ler oferta')
    mocks.state.offerLookup = { data: null as never, error: failure }

    await expect(saveOffer({ ...baseInput, productIds: [] })).rejects.toBe(failure)

    expectNoWrites()
  })
})

type ElementProps = { children?: ReactNode; name?: string; readOnly?: boolean; defaultValue?: string }

function findInput(node: ReactNode, name: string): ElementProps | null {
  if (!isValidElement(node)) return null
  const props = node.props as ElementProps
  if (node.type === 'input' && props.name === name) return props
  for (const child of Children.toArray(props.children)) {
    const found = findInput(child, name)
    if (found) return found
  }
  return null
}

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!isValidElement(node)) return ''
  return Children.toArray((node.props as ElementProps).children).map(textContent).join(' ')
}

const product: Product = {
  id: 'product-1',
  storeId: 'store-1',
  slug: 'produto',
  title: 'Produto',
  track: '',
  description: '',
  coverUrl: null,
  bannerUrl: null,
  checkoutUrl: null,
  isFeatured: false,
  sortOrder: 0,
  isPublished: true,
}

describe('formulário de oferta', () => {
  it('torna o código somente leitura na edição e orienta cadastrar outra oferta', () => {
    const offer: AdminOffer = { id: 'existing', name: 'Oferta', paytProductCode: 'OLD', productIds: ['product-1'] }
    const form = OfferForm({ offer, products: [product], initialCode: '' })

    expect(findInput(form, 'payt_product_code')).toMatchObject({ readOnly: true, defaultValue: 'OLD' })
    expect(textContent(form)).toContain('cadastre uma nova oferta')
  })

  it('mantém o código editável na criação', () => {
    const form = OfferForm({ offer: null, products: [product], initialCode: 'NEW' })

    expect(findInput(form, 'payt_product_code')).toMatchObject({ defaultValue: 'NEW' })
    expect(findInput(form, 'payt_product_code')?.readOnly).not.toBe(true)
  })
})
