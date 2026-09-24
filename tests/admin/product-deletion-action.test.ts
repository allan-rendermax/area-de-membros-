import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as actions from '@/app/admin/(painel)/produtos/actions'

const io = vi.hoisted(() => ({ requireAdmin: vi.fn(), getAdminStore: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: io.requireAdmin }))
vi.mock('@/lib/data/stores', () => ({ getDefaultStore: vi.fn(), getStoreBySlug: vi.fn() }))
vi.mock('@/lib/admin/current-store', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/admin/current-store')>(), getAdminStore: io.getAdminStore }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: io.rpc }) }))
vi.mock('next/cache', () => ({ revalidatePath: io.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${decodeURIComponent(path)}`) } }))

const storeId = '00000000-0000-4000-8000-000000000001'
const productId = '00000000-0000-4000-8000-000000000101'
function form(overrides: Record<string, string> = {}) {
  const result = new FormData()
  for (const [key, value] of Object.entries({ id: productId, store_id: storeId, confirmation: 'Produto de teste', ...overrides })) result.set(key, value)
  return result
}
function remove(data = form()) {
  return actions.excluirProduto({ error: null }, data)
}

beforeEach(() => {
  vi.resetAllMocks()
  io.requireAdmin.mockResolvedValue({ email: 'admin@example.test' })
  io.getAdminStore.mockResolvedValue({ id: storeId, slug: 'arquitetura' })
  io.rpc.mockResolvedValue({ data: null, error: null })
})

describe('ação de excluir produto', () => {
  it('exige admin antes de qualquer exclusão e preserva redirecionamento de login', async () => {
    io.requireAdmin.mockRejectedValue(new Error('NEXT_REDIRECT:/admin/entrar'))
    await expect(remove()).rejects.toThrow('NEXT_REDIRECT:/admin/entrar')
    expect(io.rpc).not.toHaveBeenCalled()
  })
  it('recusa formulário de outra loja sem gravar', async () => {
    expect(await remove(form({ store_id: 'outra-loja' }))).toMatchObject({ error: expect.stringMatching(/loja/i) })
    expect(io.rpc).not.toHaveBeenCalled()
  })
  it.each<Record<string, string>>([{ id: 'inválido' }, { confirmation: '' }])('recusa entrada inválida: %o', async overrides => {
    expect(await remove(form(overrides))).toMatchObject({ error: expect.any(String) })
    expect(io.rpc).not.toHaveBeenCalled()
  })
  it('usa loja da sessão na RPC, revalida após exclusão e retorna à lista', async () => {
    await expect(remove()).rejects.toThrow('NEXT_REDIRECT:/admin/produtos?msg=Produto excluído.')
    expect(io.rpc).toHaveBeenCalledExactlyOnceWith('delete_product_atomic', { p_id: productId, p_store_id: storeId, p_confirmation: 'Produto de teste' })
    expect(io.revalidatePath).toHaveBeenCalledWith('/admin', 'layout')
    expect(io.revalidatePath).toHaveBeenCalledWith('/arquitetura', 'layout')
    expect(io.rpc.mock.invocationCallOrder[0]).toBeLessThan(io.revalidatePath.mock.invocationCallOrder[0])
  })
  it('apresenta bloqueio de oferta sem relatar sucesso ou invalidar cache', async () => {
    io.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Produto vinculado a uma oferta. Oculte o produto.' } })
    expect(await remove()).toEqual({ error: 'Produto vinculado a uma oferta. Oculte o produto.' })
    expect(io.revalidatePath).not.toHaveBeenCalled()
  })
  it('orienta aplicar a migração quando a RPC ainda não existe', async () => {
    io.rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'missing function' } })
    expect(await remove()).toMatchObject({ error: expect.stringMatching(/migração/i) })
    expect(io.revalidatePath).not.toHaveBeenCalled()
  })
  it('não expõe detalhes internos de falhas do banco', async () => {
    io.rpc.mockResolvedValue({ error: { code: 'XX000', message: 'internal connection details' } })
    const result = await remove()
    expect(result.error).toMatch(/Não foi possível excluir/)
    expect(result.error).not.toContain('internal')
    expect(io.revalidatePath).not.toHaveBeenCalled()
  })
})
