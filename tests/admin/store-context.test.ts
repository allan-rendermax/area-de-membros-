import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const storeA = { id: '0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c', slug: 'loja-a' }
const storeB = { id: '1b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c', slug: 'loja-b' }
const customerId = '2b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c'
const offerId = '3b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c'
const orderId = '4b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c'

const io = vi.hoisted(() => ({
  getAdminStore: vi.fn(), saveProduct: vi.fn(), saveOffer: vi.fn(), uploadImage: vi.fn(),
  resendAccessForCustomer: vi.fn(), createManualOrder: vi.fn(), revokeManualOrder: vi.fn(),
}))
vi.mock('@/lib/admin/current-store', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/admin/current-store')>()), getAdminStore: io.getAdminStore }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: vi.fn().mockResolvedValue({ email: 'admin@example.com' }) }))
vi.mock('@/lib/data/products-admin', () => ({ saveProduct: io.saveProduct, saveOffer: io.saveOffer, uploadImage: io.uploadImage }))
vi.mock('@/lib/data/products', () => ({ getProductById: vi.fn() }))
vi.mock('@/lib/data/customers', () => ({ changeCustomerEmail: vi.fn(), setCustomerBlocked: vi.fn() }))
vi.mock('@/lib/data/orders', () => ({ createManualOrder: io.createManualOrder, revokeManualOrder: io.revokeManualOrder }))
vi.mock('@/lib/email/server', () => ({ resendAccessForCustomer: io.resendAccessForCustomer }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${decodeURIComponent(url)}`) } }))
vi.mock('@/components/membros/auto-cover', () => ({ AutoCover: () => null }))

import { salvarProduto } from '@/app/admin/(painel)/produtos/actions'
import { salvarOferta } from '@/app/admin/(painel)/ofertas/actions'
import { reenviarAcesso, liberarAcessoManual, removerAcessoManual } from '@/app/admin/(painel)/clientes/actions'
import { ProductForm } from '@/app/admin/(painel)/produtos/product-form'
import { OfferForm } from '@/app/admin/(painel)/ofertas/offer-form'

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  io.getAdminStore.mockResolvedValue(storeB)
  io.saveProduct.mockResolvedValue(customerId)
  io.saveOffer.mockResolvedValue(offerId)
  io.resendAccessForCustomer.mockResolvedValue({ ok: true })
})

describe('contexto da loja no envio', () => {
  it.each([
    ['produto', salvarProduto, { title: 'Produto' }, io.saveProduct],
    ['oferta', salvarOferta, { name: 'Oferta', payt_product_code: 'OFERTA', product_ids: offerId }, io.saveOffer],
    ['reenvio', reenviarAcesso, { id: customerId }, io.resendAccessForCustomer],
    ['liberação manual', liberarAcessoManual, { id: customerId, offerId }, io.createManualOrder],
    ['revogação manual', removerAcessoManual, { id: customerId, orderId }, io.revokeManualOrder],
  ])('%s rejeita loja alterada antes do IO', async (_label, action, fields, write) => {
    await expect(action(form({ ...fields, store_id: storeA.id }))).rejects.toThrow(/NEXT_REDIRECT:.*loja/i)
    expect(write).not.toHaveBeenCalled()
  })

  it.each([
    ['produto', salvarProduto, { title: 'Produto' }, io.saveProduct],
    ['oferta', salvarOferta, { name: 'Oferta', payt_product_code: 'OFERTA', product_ids: offerId }, io.saveOffer],
    ['reenvio', reenviarAcesso, { id: customerId }, io.resendAccessForCustomer],
    ['liberação manual', liberarAcessoManual, { id: customerId, offerId }, io.createManualOrder],
    ['revogação manual', removerAcessoManual, { id: customerId, orderId }, io.revokeManualOrder],
  ])('%s rejeita store_id ausente', async (_label, action, fields, write) => {
    await expect(action(form(fields))).rejects.toThrow(/NEXT_REDIRECT:.*loja/i)
    expect(write).not.toHaveBeenCalled()
  })

  it('aceita a loja atual para produto e oferta', async () => {
    await expect(salvarProduto(form({ store_id: storeB.id, title: 'Produto' }))).rejects.toThrow(/NEXT_REDIRECT/)
    await expect(salvarOferta(form({ store_id: storeB.id, name: 'Oferta', payt_product_code: 'OFERTA', product_ids: offerId }))).rejects.toThrow(/NEXT_REDIRECT/)
    expect(io.saveProduct).toHaveBeenCalledOnce()
    expect(io.saveOffer).toHaveBeenCalledOnce()
  })

  it('aceita a loja atual para as ações manuais e reenvio', async () => {
    await expect(reenviarAcesso(form({ store_id: storeB.id, id: customerId }))).rejects.toThrow(/NEXT_REDIRECT/)
    await expect(liberarAcessoManual(form({ store_id: storeB.id, id: customerId, offerId }))).rejects.toThrow(/NEXT_REDIRECT/)
    await expect(removerAcessoManual(form({ store_id: storeB.id, id: customerId, orderId }))).rejects.toThrow(/NEXT_REDIRECT/)
    expect(io.resendAccessForCustomer).toHaveBeenCalledOnce()
    expect(io.createManualOrder).toHaveBeenCalledOnce()
    expect(io.revokeManualOrder).toHaveBeenCalledOnce()
  })

  it('inclui store_id nos formulários de produto e oferta', () => {
    expect(renderToStaticMarkup(ProductForm({ product: null, tracks: [], storeId: storeA.id }))).toContain(`name="store_id" value="${storeA.id}"`)
    expect(renderToStaticMarkup(OfferForm({ offer: null, products: [], initialCode: '', storeId: storeA.id }))).toContain(`name="store_id" value="${storeA.id}"`)
  })
})
