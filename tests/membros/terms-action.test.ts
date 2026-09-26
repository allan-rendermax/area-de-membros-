import { beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptTerms } from '@/app/[loja]/boas-vindas/actions'
import { requireStoreIdentity } from '@/lib/membros/session'
import { acceptMemberTerms } from '@/lib/data/member-terms'
import { revalidatePath } from 'next/cache'

vi.mock('@/lib/membros/session', () => ({ requireStoreIdentity: vi.fn() }))
vi.mock('@/lib/data/member-terms', () => ({ acceptMemberTerms: vi.fn(), requiresMemberTerms: (slug: string) => slug === 'arquitetura' }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) },
  unstable_rethrow: (error: unknown) => { if (String(error).includes('REDIRECT:')) throw error },
}))
const session = { store: { id: 'store-id', slug: 'arquitetura' }, customer: { id: 'customer-id' } }
function form() { const data = new FormData(); data.set('accept', 'yes'); return data }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireStoreIdentity).mockResolvedValue(session as never)
  vi.mocked(acceptMemberTerms).mockResolvedValue()
})
describe('aceite explícito autenticado', () => {
  it('salva somente a identidade da sessão e redireciona após sucesso', async () => {
    const data = form(); data.set('customerId', 'someone-else'); data.set('storeId', 'other-store')
    await expect(acceptTerms('arquitetura', { error: null }, data)).rejects.toThrow('REDIRECT:/arquitetura')
    expect(acceptMemberTerms).toHaveBeenCalledWith('customer-id', 'store-id')
    expect(revalidatePath).toHaveBeenCalledWith('/arquitetura', 'layout')
  })
  it('não grava sem confirmação explícita', async () => {
    expect(await acceptTerms('arquitetura', { error: null }, new FormData())).toMatchObject({ error: expect.any(String) })
    expect(acceptMemberTerms).not.toHaveBeenCalled()
  })
  it('preserva redirect de visitante sem gravar', async () => {
    vi.mocked(requireStoreIdentity).mockRejectedValueOnce(new Error('REDIRECT:/arquitetura/entrar'))
    await expect(acceptTerms('arquitetura', { error: null }, form())).rejects.toThrow('REDIRECT:/arquitetura/entrar')
    expect(acceptMemberTerms).not.toHaveBeenCalled()
  })
  it('informa falha e não libera a área quando a gravação falha', async () => {
    vi.mocked(acceptMemberTerms).mockRejectedValueOnce(new Error('DB unavailable'))
    expect(await acceptTerms('arquitetura', { error: null }, form())).toEqual({ error: 'Não foi possível salvar seu aceite. Tente novamente.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it.each(['../admin', 'outra-loja'])('não aceita loja inválida ou diferente: %s', async (slug) => {
    expect(await acceptTerms(slug, { error: null }, form())).toMatchObject({ error: expect.any(String) })
    expect(acceptMemberTerms).not.toHaveBeenCalled()
  })
})
