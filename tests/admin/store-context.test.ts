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
  listProducts: vi.fn(), listOffers: vi.fn(), getProductById: vi.fn(), deleteItem: vi.fn(), moveItem: vi.fn(),
}))
vi.mock('@/lib/admin/current-store', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/admin/current-store')>()), getAdminStore: io.getAdminStore }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: vi.fn().mockResolvedValue({ email: 'admin@example.com' }) }))
vi.mock('@/lib/data/products-admin', () => ({ saveProduct: io.saveProduct, saveOffer: io.saveOffer, uploadImage: io.uploadImage, listOffers: io.listOffers, deleteItem: io.deleteItem, moveItem: io.moveItem }))
vi.mock('@/lib/data/products', () => ({ getProductById: io.getProductById, listProducts: io.listProducts }))
vi.mock('@/lib/data/customers', () => ({ changeCustomerEmail: vi.fn(), setCustomerBlocked: vi.fn() }))
vi.mock('@/lib/data/orders', () => ({ createManualOrder: io.createManualOrder, revokeManualOrder: io.revokeManualOrder }))
vi.mock('@/lib/email/server', () => ({ resendAccessForCustomer: io.resendAccessForCustomer }))
vi.mock('@/lib/admin/product-publication', () => ({ assertProductPublicationReady: vi.fn(), assertOfferProductsReady: vi.fn() }))
vi.mock('@/lib/data/product-image-uploads', () => ({ validateProductImageReference: vi.fn(), createProductImageUpload: vi.fn() }))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  unstable_cache: <T extends (...args: never[]) => unknown>(load: T) => load,
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/produtos/novo', useSearchParams: () => new URLSearchParams(), unstable_rethrow: vi.fn(), redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${decodeURIComponent(url)}`) } }))
vi.mock('@/components/membros/auto-cover', () => ({ AutoCover: () => null }))

import { excluirItem, moverItem, salvarProduto } from '@/app/admin/(painel)/produtos/actions'
import { salvarOferta } from '@/app/admin/(painel)/ofertas/actions'
import { reenviarAcesso, liberarAcessoManual, removerAcessoManual } from '@/app/admin/(painel)/clientes/actions'
import { ProductForm } from '@/app/admin/(painel)/produtos/product-form'
import { OfferForm } from '@/app/admin/(painel)/ofertas/offer-form'
import ProdutosPage from '@/app/admin/(painel)/produtos/page'
import OfertasPage from '@/app/admin/(painel)/ofertas/page'

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
  io.listProducts.mockResolvedValue([])
  io.listOffers.mockResolvedValue([])
  io.getProductById.mockResolvedValue(null)
  io.deleteItem.mockResolvedValue(undefined)
  io.moveItem.mockResolvedValue(undefined)
})

describe('produto autorizado nas mutações de material', () => {
  it.each([['excluir', excluirItem, io.deleteItem], ['mover', moverItem, io.moveItem]])('%s rejeita produto fora da loja atual antes de mutar', async (_label, action, write) => {
    io.getProductById.mockResolvedValue({ id: customerId, storeId: storeA.id })
    await expect(action(form({ product_id: customerId, id: offerId, module_id: orderId }))).rejects.toThrow('NEXT_REDIRECT:/admin/produtos')
    expect(write).not.toHaveBeenCalled()
  })

  it('usa o produto retornado pela validação para excluir', async () => {
    io.getProductById.mockResolvedValue({ id: customerId, storeId: storeB.id })
    await expect(excluirItem(form({ product_id: customerId, id: offerId }))).rejects.toThrow(/Item excluído/)
    expect(io.deleteItem).toHaveBeenCalledWith(offerId, customerId)
  })

  it('usa o produto retornado pela validação para mover', async () => {
    io.getProductById.mockResolvedValue({ id: customerId, storeId: storeB.id })
    await expect(moverItem(form({ product_id: customerId, id: offerId, module_id: orderId, direcao: 'up' }))).rejects.toThrow(/Ordem atualizada/)
    expect(io.moveItem).toHaveBeenCalledWith(offerId, orderId, customerId, 'up')
  })

  it('mostra falha de escopo sem anunciar sucesso', async () => {
    io.getProductById.mockResolvedValue({ id: customerId, storeId: storeB.id })
    io.deleteItem.mockRejectedValueOnce(new Error('Item inválido para este produto.'))
    await expect(excluirItem(form({ product_id: customerId, id: offerId }))).rejects.toThrow(/Item inválido para este produto/)
  })
})

describe('contexto da loja no envio', () => {
  it.each([
    ['oferta', salvarOferta, { name: 'Oferta', payt_product_code: 'OFERTA', product_ids: offerId }, io.saveOffer],
    ['reenvio', reenviarAcesso, { id: customerId }, io.resendAccessForCustomer],
    ['liberação manual', liberarAcessoManual, { id: customerId, offerId }, io.createManualOrder],
    ['revogação manual', removerAcessoManual, { id: customerId, orderId }, io.revokeManualOrder],
  ])('%s rejeita loja alterada antes do IO', async (_label, action, fields, write) => {
    await expect(action(form({ ...fields, store_id: storeA.id }))).rejects.toThrow(/NEXT_REDIRECT:.*loja/i)
    expect(write).not.toHaveBeenCalled()
  })

  it.each([
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

  it('leva o papel complementar do formulário pela action até a persistência', async () => {
    await expect(salvarProduto(form({ store_id: storeB.id, title: 'Extra', role: 'upsell', checkout_url: 'https://payt.example/extra' })))
      .rejects.toThrow(/NEXT_REDIRECT/)
    expect(io.saveProduct).toHaveBeenCalledWith(expect.objectContaining({ role: 'upsell', checkoutUrl: 'https://payt.example/extra' }))
  })

  it('persiste referência da imagem enviada separadamente na action autorizada', async () => {
    const input = form({ store_id: storeB.id, title: 'Produto', purchase_title: 'Libere seu pack', purchase_description: 'Texto do modal', purchase_button_text: 'Quero comprar', purchase_image_url: 'https://example.com/saved-modal.png', purchase_image_receipt: 'signed-receipt' })
    await expect(salvarProduto(input)).rejects.toThrow(/NEXT_REDIRECT/)
    expect(io.uploadImage).not.toHaveBeenCalled()
    expect(io.saveProduct).toHaveBeenCalledWith(expect.objectContaining({ purchaseTitle: 'Libere seu pack', purchaseDescription: 'Texto do modal', purchaseButtonText: 'Quero comprar', purchaseImageUrl: 'https://example.com/saved-modal.png' }))
  })

  it('expõe a escolha de papel no formulário de criação', () => {
    const html = renderToStaticMarkup(ProductForm({ product: null, tracks: [], storeId: storeA.id }))
    expect(html).toContain('name="role"')
    expect(html).toContain('value="orderbump"')
    expect(html).toContain('value="upsell"')
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

  it.each([
    ['oferta existente', salvarOferta, { id: offerId, name: 'Oferta' }, io.saveOffer, '/admin/ofertas'],
  ])('%s com loja alterada mostra erro em lista acessível', async (_label, action, fields, write, path) => {
    await expect(action(form({ ...fields, store_id: storeA.id }))).rejects.toThrow(
      `NEXT_REDIRECT:${path}?msg=A loja foi alterada em outra aba. Recarregue a página antes de salvar.`,
    )
    expect(write).not.toHaveBeenCalled()
  })

  it('mostra o aviso de loja alterada nas listas de produtos e ofertas', async () => {
    const props = {
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ msg: 'A loja foi alterada em outra aba. Recarregue a página antes de salvar.' }),
    }
    const productsHtml = renderToStaticMarkup(await ProdutosPage(props))
    const offersHtml = renderToStaticMarkup(await OfertasPage(props))
    expect(productsHtml).toContain('role="status"')
    expect(productsHtml).toContain('A loja foi alterada em outra aba.')
    expect(offersHtml).toContain('role="status"')
    expect(offersHtml).toContain('A loja foi alterada em outra aba.')
  })
})
