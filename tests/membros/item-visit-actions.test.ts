import { beforeEach, describe, expect, it, vi } from 'vitest'
import { after } from 'next/server'
import { recordVisit } from '@/app/[loja]/historico/actions'
import { getItemWithContext } from '@/lib/data/products'
import { loadGrantedProductLevels } from '@/lib/data/access'
import { requireStoreSession } from '@/lib/membros/session'
import { createAdminClient } from '@/lib/supabase/admin'

vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/data/products', () => ({ getItemWithContext: vi.fn() }))
vi.mock('@/lib/data/access', () => ({ loadGrantedProductLevels: vi.fn() }))
vi.mock('@/lib/membros/session', () => ({ requireStoreSession: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
const store = { id: 'store-a', slug: 'loja-a' }
const customer = { id: 'customer-a' }
const ctx = {
  item: { id, kind: 'video', isPublished: true, url: 'https://youtu.be/dQw4w9WgXcQ' },
  module: { id: 'module-a', requiredLevel: 'basic', isPublished: true },
  product: { id: 'product-a', storeId: 'store-a', isPublished: true, contentMode: 'versions' },
}

describe('autorização de histórico de vídeo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireStoreSession).mockResolvedValue({ store, customer } as never)
    vi.mocked(getItemWithContext).mockResolvedValue(ctx as never)
    vi.mocked(loadGrantedProductLevels).mockResolvedValue(new Map([['product-a', 'basic']]))
  })
  it('revalida sessão e acesso e usa somente IDs derivados no servidor', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn(() => ({ insert })) } as never)
    expect(await recordVisit('loja-a', id)).toEqual({ ok: true })
    expect(requireStoreSession).toHaveBeenCalledWith('loja-a')
    expect(loadGrantedProductLevels).toHaveBeenCalledWith('store-a', customer)
    expect(insert).not.toHaveBeenCalled()
    await (vi.mocked(after).mock.calls[0][0] as () => Promise<void>)()
    expect(insert).toHaveBeenCalledWith({ customer_id: 'customer-a', store_id: 'store-a', product_id: 'product-a', item_id: id, kind: 'video' })
  })
  it.each([['bad/slug', id], ['loja-a', 'not-uuid']])('rejeita entrada inválida %s / %s sem sessão ou escrita', async (slug, itemId) => {
    expect(await recordVisit(slug, itemId)).toEqual({ ok: false })
    expect(requireStoreSession).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
  })
  it('não consulta item nem agenda quando a sessão não é válida', async () => {
    vi.mocked(requireStoreSession).mockRejectedValue(new Error('SESSION_REQUIRED'))
    expect(await recordVisit('loja-a', id)).toEqual({ ok: false })
    expect(getItemWithContext).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
  })
  it.each([
    null,
    { ...ctx, product: { ...ctx.product, storeId: 'other-store' } },
    { ...ctx, product: { ...ctx.product, isPublished: false } },
    { ...ctx, module: { ...ctx.module, isPublished: false } },
    { ...ctx, item: { ...ctx.item, isPublished: false } },
    { ...ctx, item: { ...ctx.item, kind: 'arquivo' } },
    { ...ctx, item: { ...ctx.item, url: 'javascript:alert(1)' } },
    { ...ctx, module: { ...ctx.module, requiredLevel: 'complete' } },
  ])('recusa material ausente, de outra loja, oculto, inválido ou de outro nível', async (invalid) => {
    vi.mocked(getItemWithContext).mockResolvedValue(invalid as never)
    expect(await recordVisit('loja-a', id)).toEqual({ ok: false })
    expect(after).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it.each([new Map(), new Map([['product-a', 'complete' as const]])])('não registra conteúdo sem compra ou Básico para Completo no modo versões', async (levels) => {
    vi.mocked(loadGrantedProductLevels).mockResolvedValue(levels)
    expect(await recordVisit('loja-a', id)).toEqual({ ok: false })
    expect(after).not.toHaveBeenCalled()
  })
  it('recusa loja que não corresponde à sessão', async () => {
    vi.mocked(requireStoreSession).mockResolvedValue({ store: { ...store, slug: 'other-store' }, customer } as never)
    expect(await recordVisit('loja-a', id)).toEqual({ ok: false })
    expect(after).not.toHaveBeenCalled()
  })
})
