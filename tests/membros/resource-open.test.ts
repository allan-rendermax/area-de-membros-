import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notFound, redirect } from 'next/navigation'
import { GET } from '@/app/[loja]/item/[id]/abrir/route'
import { loadGrantedProductLevels } from '@/lib/data/access'
import { recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'
import { createAdminClient } from '@/lib/supabase/admin'

vi.mock('next/navigation', () => ({ notFound: vi.fn(), redirect: vi.fn() }))
vi.mock('@/lib/data/access', () => ({ loadGrantedProductLevels: vi.fn() }))
vi.mock('@/lib/data/item-access', () => ({ recordItemAccess: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ getItemWithContext: vi.fn() }))
vi.mock('@/lib/membros/session', () => ({ requireStoreSession: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: { supabaseUrl: 'https://project.supabase.co' } }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

const id = '11111111-1111-4111-8111-111111111111'
const store = { id: 'store-a', slug: 'loja-a', name: 'Loja A', logoUrl: null, supportUrl: null, supportWhatsapp: null, loginImageUrl: null }
const customer = { id: 'customer-a', email: 'aluna@example.com', name: 'Aluna', blockedAt: null }
const product = { id: 'product-a', storeId: store.id, slug: 'produto-a', title: 'Produto A', track: '', description: '', coverUrl: null, bannerUrl: null, checkoutUrl: null, role: 'front' as const, isFeatured: false, sortOrder: 0, isPublished: true }
const courseModule = { id: 'module-a', productId: product.id, title: 'Módulo A', sortOrder: 0, isPublished: true }
const item = { id, moduleId: courseModule.id, title: 'Apostila', kind: 'arquivo' as const, url: 'https://project.supabase.co/storage/v1/object/public/arquivos/aula.pdf', coverUrl: null, sortOrder: 0, isPublished: true }
const ctx = { item, module: courseModule, product }
const request = new Request(`https://app.example.com/loja-a/item/${id}/abrir`)
const params = (value = id) => ({ params: Promise.resolve({ loja: 'loja-a', id: value }) })

describe('rota protegida para abrir recurso', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(notFound).mockImplementation(() => { throw new Error('NEXT_NOT_FOUND') })
    vi.mocked(redirect).mockImplementation((url) => { throw new Error(`NEXT_REDIRECT:${url}`) })
    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer })
    vi.mocked(getItemWithContext).mockResolvedValue(ctx)
    vi.mocked(loadGrantedProductLevels).mockResolvedValue(new Map([[product.id, 'complete']]))
    vi.mocked(recordItemAccess).mockResolvedValue()
  })

  it('rejeita UUID inválido antes de consultar sessão', async () => {
    await expect(GET(request, params('invalid'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(requireStoreSession).not.toHaveBeenCalled()
  })

  it('impede que Completo abra arquivo Básico diretamente no modo versões', async () => {
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ ...ctx, product: { ...product, contentMode: 'versions' } })
    await expect(GET(request, params())).rejects.toThrow('NEXT_REDIRECT:/loja-a/produto/produto-a?bloqueado=1')
    expect(recordItemAccess).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('não consulta item sem uma sessão válida', async () => {
    vi.mocked(requireStoreSession).mockRejectedValueOnce(new Error('SESSION_REQUIRED'))
    await expect(GET(request, params())).rejects.toThrow('SESSION_REQUIRED')
    expect(getItemWithContext).not.toHaveBeenCalled()
    expect(recordItemAccess).not.toHaveBeenCalled()
  })

  it.each([
    null,
    { ...ctx, product: { ...product, storeId: 'store-b' } },
    { ...ctx, product: { ...product, isPublished: false } },
    { ...ctx, module: { ...courseModule, isPublished: false } },
    { ...ctx, item: { ...item, isPublished: false } },
    { ...ctx, item: { ...item, kind: 'video' as const } },
    { ...ctx, item: { ...item, url: 'javascript:alert(1)' } },
  ])('não expõe destino para contexto oculto, inválido ou vídeo', async (invalid) => {
    vi.mocked(getItemWithContext).mockResolvedValueOnce(invalid)
    await expect(GET(request, params())).rejects.toThrow('NEXT_NOT_FOUND')
    expect(recordItemAccess).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redireciona para compra antes de registrar quando produto não foi comprado', async () => {
    vi.mocked(loadGrantedProductLevels).mockResolvedValueOnce(new Map())
    await expect(GET(request, params())).rejects.toThrow('NEXT_REDIRECT:/loja-a?comprar=produto-a')
    expect(recordItemAccess).not.toHaveBeenCalled()
  })

  it('bloqueia download extra antes de registrar ou assinar', async () => {
    vi.mocked(loadGrantedProductLevels).mockResolvedValueOnce(new Map([[product.id, 'basic']]))
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ ...ctx, module: { ...courseModule, requiredLevel: 'complete' }, item: { ...item, url: 'https://project.supabase.co/storage/v1/object/authenticated/arquivos-restritos/modelo.pdf' } })
    await expect(GET(request, params())).rejects.toThrow('NEXT_REDIRECT:/loja-a/produto/produto-a?bloqueado=1')
    expect(recordItemAccess).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('assina arquivo privado apenas para nível autorizado e redireciona para URL assinada', async () => {
    const signedUrl = 'https://project.supabase.co/storage/v1/object/sign/arquivos-restritos/modelo.pdf?token=short'
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl }, error: null })
    vi.mocked(createAdminClient).mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl })) } } as unknown as ReturnType<typeof createAdminClient>)
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ ...ctx, module: { ...courseModule, requiredLevel: 'complete' }, item: { ...item, url: 'https://project.supabase.co/storage/v1/object/authenticated/arquivos-restritos/modelo.pdf' } })
    await expect(GET(request, params())).rejects.toThrow(`NEXT_REDIRECT:${signedUrl}`)
    expect(createSignedUrl).toHaveBeenCalledWith('modelo.pdf', 60, { download: true })
    expect(recordItemAccess).toHaveBeenCalledOnce()
  })

  it('não registra nem redireciona se assinatura falha', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: null, error: new Error('storage unavailable') })
    vi.mocked(createAdminClient).mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl })) } } as unknown as ReturnType<typeof createAdminClient>)
    vi.mocked(getItemWithContext).mockResolvedValueOnce({ ...ctx, item: { ...item, url: 'https://project.supabase.co/storage/v1/object/authenticated/arquivos-restritos/modelo.pdf' } })
    await expect(GET(request, params())).rejects.toThrow('NEXT_NOT_FOUND')
    expect(recordItemAccess).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('aguarda o registro do clique autorizado antes de redirecionar, sem buscar bytes', async () => {
    const originalFetch = globalThis.fetch
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    let finishRecord!: () => void
    const pendingRecord = new Promise<void>((resolve) => { finishRecord = resolve })
    vi.mocked(recordItemAccess).mockReturnValueOnce(pendingRecord)
    try {
      const opening = GET(request, params())
      await vi.waitFor(() => expect(recordItemAccess).toHaveBeenCalledOnce())
      expect(redirect).not.toHaveBeenCalled()
      finishRecord()
      await expect(opening).rejects.toThrow(`NEXT_REDIRECT:${item.url}?download=`)
      expect(recordItemAccess).toHaveBeenCalledWith({ customerId: customer.id, storeId: store.id, productId: product.id, itemId: item.id, kind: item.kind })
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
