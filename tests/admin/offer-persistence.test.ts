import { Children, isValidElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OfferForm } from '@/app/admin/(painel)/ofertas/offer-form'
import type { OfferInput } from '@/lib/admin/forms'
import { getOffer, saveOffer, type AdminOffer } from '@/lib/data/products-admin'
import type { Product } from '@/lib/domain/types'

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc, from }) }))
vi.mock('@/app/admin/(painel)/ofertas/actions', () => ({ salvarOferta: vi.fn() }))

const baseInput: OfferInput = {
  id: 'existing', storeId: 'store-1', name: 'Oferta atualizada',
  paytProductCode: 'OLD', productIds: ['product-1'], productLevels: { 'product-1': 'basic' },
}

beforeEach(() => {
  rpc.mockReset()
  from.mockReset()
  rpc.mockResolvedValue({ data: 'existing', error: null })
})

describe('persistência de ofertas', () => {
  it('salva a seleção inteira em uma única RPC', async () => {
    await expect(saveOffer(baseInput)).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledExactlyOnceWith('save_offer_levels_atomic', {
      p_id: 'existing', p_store_id: 'store-1', p_name: 'Oferta atualizada',
      p_product_code: 'OLD', p_grants: [{ product_id: 'product-1', grant_level: 'basic' }],
    })
  })

  it('recusa seleção vazia antes de persistir', async () => {
    await expect(saveOffer({ ...baseInput, productIds: [] })).rejects.toThrow('produto')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('explica quando a migration da RPC ainda não foi aplicada', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } })
    await expect(saveOffer(baseInput)).rejects.toThrow('migração')
  })
  it('recusa nível inválido antes da RPC', async () => {
    await expect(saveOffer({ ...baseInput, productLevels: { 'product-1': 'vip' as 'basic' } })).rejects.toThrow('Nível')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reabre níveis de produtos em uma oferta com mais de um produto', async () => {
    const row = { id: 'offer-1', name: 'Bundle', payt_product_code: 'BUNDLE', offer_products: [
      { product_id: 'product-1', grant_level: 'basic' }, { product_id: 'product-2', grant_level: 'complete' },
    ] }
    const query = { eq: () => query, maybeSingle: async () => ({ data: row, error: null }) }
    from.mockReturnValue({ select: () => query })
    await expect(getOffer('offer-1', 'store-1')).resolves.toMatchObject({
      productIds: ['product-1', 'product-2'], productLevels: { 'product-1': 'basic', 'product-2': 'complete' },
    })
  })
})

type ElementProps = { children?: ReactNode; name?: string; readOnly?: boolean; defaultValue?: string }
function findInput(node: ReactNode, name: string): ElementProps | null {
  if (!isValidElement(node)) return null
  const props = node.props as ElementProps
  if ((node.type === 'input' || node.type === 'select') && props.name === name) return props
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
  id: 'product-1', storeId: 'store-1', slug: 'produto', title: 'Produto', track: '',
  description: '', coverUrl: null, bannerUrl: null, checkoutUrl: null, role: 'front',
  isFeatured: false, sortOrder: 0, isPublished: true,
}
describe('formulário de oferta', () => {
  it('torna o código somente leitura na edição e orienta cadastrar outra oferta', () => {
    const offer: AdminOffer = { id: 'existing', name: 'Oferta', paytProductCode: 'OLD', productIds: ['product-1'] }
    const form = OfferForm({ offer, products: [product], initialCode: '', storeId: 'store-1' })
    expect(findInput(form, 'payt_product_code')).toMatchObject({ readOnly: true, defaultValue: 'OLD' })
    expect(textContent(form)).toContain('cadastre uma nova oferta')
  })
  it('mantém o código editável na criação', () => {
    const form = OfferForm({ offer: null, products: [product], initialCode: 'NEW', storeId: 'store-1' })
    expect(findInput(form, 'payt_product_code')).toMatchObject({ defaultValue: 'NEW' })
    expect(findInput(form, 'payt_product_code')?.readOnly).not.toBe(true)
  })
  it('reabre o nível salvo e mantém complete como padrão em novas ofertas', () => {
    const offer: AdminOffer = { id: 'existing', name: 'Oferta', paytProductCode: 'OLD', productIds: ['product-1'], productLevels: { 'product-1': 'basic' } }
    expect(findInput(OfferForm({ offer, products: [product], initialCode: '', storeId: 'store-1' }), 'grant_level_product-1')?.defaultValue).toBe('basic')
    expect(findInput(OfferForm({ offer: null, products: [product], initialCode: '', storeId: 'store-1' }), 'grant_level_product-1')?.defaultValue).toBe('complete')
  })
})
