import { beforeEach, describe, expect, it, vi } from 'vitest'
import { redirect } from 'next/navigation'
import { saveCompletion } from '@/app/[loja]/progresso/actions'
import { requireStoreSession } from '@/lib/membros/session'
import { getItemWithContext } from '@/lib/data/products'
import { loadGrantedProductIds } from '@/lib/data/access'
import { setItemCompletion } from '@/lib/data/member-progress'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/membros/session', () => ({ requireStoreSession: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ getItemWithContext: vi.fn() }))
vi.mock('@/lib/data/access', () => ({ loadGrantedProductIds: vi.fn() }))
vi.mock('@/lib/data/member-progress', () => ({ setItemCompletion: vi.fn() }))

const itemId = '11111111-1111-4111-8111-111111111111'
const store = { id: 'store-a', slug: 'loja-a', name: 'Loja A', logoUrl: null, supportUrl: null, supportWhatsapp: null, loginImageUrl: null }
const customer = { id: 'customer-a', email: 'aluna@example.com', name: 'Aluna', blockedAt: null }
const product = { id: 'product-a', storeId: store.id, slug: 'produto-a', title: 'Produto A', track: '', description: '', coverUrl: null, bannerUrl: null, checkoutUrl: null, isFeatured: false, sortOrder: 0, isPublished: true }
const courseModule = { id: 'module-a', productId: product.id, title: 'Módulo', sortOrder: 0, isPublished: true }
const item = { id: itemId, moduleId: courseModule.id, title: 'Aula', kind: 'video' as const, url: 'https://youtu.be/abcdefghijk', coverUrl: null, sortOrder: 0, isPublished: true }

describe('conclusão autorizada', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer })
    vi.mocked(getItemWithContext).mockResolvedValue({ item, module: courseModule, product })
    vi.mocked(loadGrantedProductIds).mockResolvedValue(new Set([product.id]))
    vi.mocked(setItemCompletion).mockResolvedValue()
  })

  it('rejeita loja de outra sessão sem escrever', async () => {
    expect(await saveCompletion('outra-loja', itemId, true)).toMatchObject({ ok: false })
    expect(setItemCompletion).not.toHaveBeenCalled()
  })

  it('rejeita acesso revogado no momento da escrita', async () => {
    vi.mocked(loadGrantedProductIds).mockResolvedValueOnce(new Set())
    expect(await saveCompletion(store.slug, itemId, true)).toMatchObject({ ok: false })
    expect(setItemCompletion).not.toHaveBeenCalled()
  })

  it.each([
    { ...product, storeId: 'store-b' },
    { ...product, isPublished: false },
  ])('rejeita produto de outra loja ou oculto', async (invalidProduct) => {
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ item, module: courseModule, product: invalidProduct })
    expect(await saveCompletion(store.slug, itemId, true)).toMatchObject({ ok: false })
    expect(setItemCompletion).not.toHaveBeenCalled()
  })

  it('rejeita módulo oculto', async () => {
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ item, module: { ...courseModule, isPublished: false }, product })
    expect(await saveCompletion(store.slug, itemId, true)).toMatchObject({ ok: false })
    expect(setItemCompletion).not.toHaveBeenCalled()
  })

  it('rejeita item sem destino válido', async () => {
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ item: { ...item, url: 'javascript:alert(1)' }, module: courseModule, product })
    expect(await saveCompletion(store.slug, itemId, true)).toMatchObject({ ok: false })
    expect(setItemCompletion).not.toHaveBeenCalled()
  })

  it('preserva falha de sessão e impede escrita', async () => {
    vi.mocked(requireStoreSession).mockImplementationOnce(async () => redirect('/loja-a/entrar'))
    await expect(saveCompletion(store.slug, itemId, true)).rejects.toThrow('NEXT_REDIRECT')
    expect(setItemCompletion).not.toHaveBeenCalled()
  })

  it('traduz falha operacional da sessão em erro acionável', async () => {
    vi.mocked(requireStoreSession).mockRejectedValueOnce(new Error('DB unavailable'))
    expect(await saveCompletion(store.slug, itemId, true)).toMatchObject({ ok: false, error: expect.stringMatching(/Tente novamente/) })
    expect(setItemCompletion).not.toHaveBeenCalled()
  })

  it('usa identidade da sessão e permite concluir e desfazer', async () => {
    expect(await saveCompletion(store.slug, itemId, true)).toEqual({ ok: true, completed: true })
    expect(setItemCompletion).toHaveBeenCalledWith({ customerId: customer.id, storeId: store.id, productId: product.id, itemId, completed: true })
    expect(await saveCompletion(store.slug, itemId, false)).toEqual({ ok: true, completed: false })
  })

  it('não relata sucesso quando escrita falha', async () => {
    vi.mocked(setItemCompletion).mockRejectedValueOnce(new Error('DB unavailable'))
    expect(await saveCompletion(store.slug, itemId, true)).toMatchObject({ ok: false })
  })
})
