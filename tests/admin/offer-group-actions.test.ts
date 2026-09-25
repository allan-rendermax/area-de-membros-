import { beforeEach, describe, expect, it, vi } from 'vitest'
import { salvarGrupoOferta, excluirGrupoOferta } from '@/app/admin/(painel)/ofertas/group-actions'

const store = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000201'
const product = '00000000-0000-4000-8000-000000000101'
const io = vi.hoisted(() => ({ auth: vi.fn(), store: vi.fn(), save: vi.fn(), remove: vi.fn(), revalidate: vi.fn(), readiness: vi.fn() }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: io.auth }))
vi.mock('@/lib/admin/current-store', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/admin/current-store')>(), getAdminStore: io.store }))
vi.mock('@/lib/data/offer-groups', () => ({ saveOfferGroup: io.save, deleteOfferGroup: io.remove }))
vi.mock('@/lib/admin/product-publication', () => ({ assertOfferProductsReady: io.readiness }))
vi.mock('next/cache', () => ({ revalidatePath: io.revalidate, unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) } }))
beforeEach(() => {
  vi.resetAllMocks()
  io.store.mockResolvedValue({ id: store, slug: 'arquitetura' })
  io.save.mockResolvedValue(id)
})
function form(fields: Record<string, string> = {}) {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ id: '', store_id: store, version: '0', name: 'Atlas', plans: JSON.stringify([{ id: null, name: 'Básico', paytProductCode: 'BASIC', grants: [{ productId: product, level: 'basic' }] }]), ...fields })) fd.set(k, v)
  return fd
}
describe('ações de oferta com planos', () => {
  it('autentica, salva na loja ativa e revalida admin e membros', async () => {
    await expect(salvarGrupoOferta({ error: null }, form())).rejects.toThrow(`NEXT_REDIRECT:/admin/ofertas/${id}`)
    expect(io.auth).toHaveBeenCalledOnce()
    expect(io.save).toHaveBeenCalledWith(expect.objectContaining({ storeId: store, plans: expect.any(Array) }))
    expect(io.revalidate).toHaveBeenCalledWith('/admin', 'layout')
    expect(io.revalidate).toHaveBeenCalledWith('/arquitetura', 'layout')
  })
  it.each([salvarGrupoOferta, excluirGrupoOferta])('recusa troca de loja sem persistência', async action => {
    const result = await action({ error: null }, form({ id, store_id: 'outra', confirmation: 'Atlas' }))
    expect(result.error).toBeTruthy()
    expect(io.save).not.toHaveBeenCalled()
    expect(io.remove).not.toHaveBeenCalled()
  })
  it('retorna erro no formulário sem redirect ou invalidar cache', async () => {
    io.save.mockRejectedValue(new Error('Esta oferta foi alterada. Recarregue a página.'))
    expect(await salvarGrupoOferta({ error: null }, form())).toEqual({ error: 'Esta oferta foi alterada. Recarregue a página.' })
    expect(io.revalidate).not.toHaveBeenCalled()
  })
  it('preserva validação de entrega para cada plano antes de salvar o grupo', async () => {
    io.readiness.mockRejectedValue(new Error('Publique material válido no Básico.'))
    expect(await salvarGrupoOferta({ error: null }, form())).toEqual({ error: 'Publique material válido no Básico.' })
    expect(io.readiness).toHaveBeenCalledWith(expect.objectContaining({
      storeId: store, productIds: [product], productLevels: { [product]: 'basic' },
    }))
    expect(io.save).not.toHaveBeenCalled()
  })
  it('não persiste nem valida formulário se autenticação falhar', async () => {
    io.auth.mockRejectedValue(new Error('unauthorized'))
    await expect(salvarGrupoOferta({ error: null }, form())).rejects.toThrow('unauthorized')
    expect(io.save).not.toHaveBeenCalled()
  })
  it('exige ID e confirmação para excluir grupo', async () => {
    expect((await excluirGrupoOferta({ error: null }, form({ confirmation: 'Atlas' }))).error).toBeTruthy()
    expect(io.remove).not.toHaveBeenCalled()
    await expect(excluirGrupoOferta({ error: null }, form({ id, confirmation: 'Atlas' }))).rejects.toThrow('NEXT_REDIRECT:/admin/ofertas')
    expect(io.remove).toHaveBeenCalledWith({ id, storeId: store, confirmation: 'Atlas' })
  })
})
