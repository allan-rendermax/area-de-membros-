import { beforeEach, describe, expect, it, vi } from 'vitest'
import { excluirCliente } from '@/app/admin/(painel)/clientes/actions'
import { hashEmail } from '@/lib/auth/login-guard'

const io = vi.hoisted(() => ({ requireAdmin: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: io.requireAdmin }))
vi.mock('@/lib/data/stores', () => ({ getDefaultStore: vi.fn(), getStoreBySlug: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: io.rpc }) }))
vi.mock('next/cache', () => ({ revalidatePath: io.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${decodeURIComponent(path)}`) } }))
const id = '00000000-0000-4000-8000-000000000001'
function form(overrides: Record<string, string> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ id, confirmation: 'cliente@example.test', ...overrides })) data.set(key, value)
  return data
}
const remove = (data = form()) => excluirCliente({ error: null }, data)
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.test, segundo@example.test')
  vi.stubEnv('LOGIN_GUARD_SECRET', 'test-secret')
  io.requireAdmin.mockResolvedValue({ email: 'admin@example.test' })
  io.rpc.mockResolvedValue({ error: null })
})
describe('ação de excluir cliente', () => {
  it('autentica antes de qualquer exclusão', async () => {
    io.requireAdmin.mockRejectedValue(new Error('NEXT_REDIRECT:/admin/entrar'))
    await expect(remove()).rejects.toThrow('NEXT_REDIRECT:/admin/entrar')
    expect(io.rpc).not.toHaveBeenCalled()
  })
  it.each<Record<string, string>>([{ id: 'inválido' }, { confirmation: '' }, { confirmation: 'sem-arroba' }])('valida entrada: %o', async overrides => {
    expect(await remove(form(overrides))).toMatchObject({ error: expect.any(String) })
    expect(io.rpc).not.toHaveBeenCalled()
  })
  it('envia proteção do servidor, ignora lista forjada e só revalida após sucesso', async () => {
    await expect(remove(form({ protected_emails: '', confirmation: ' CLIENTE@example.test ' }))).rejects.toThrow('NEXT_REDIRECT:/admin/clientes?msg=Cliente, pedidos e registros vinculados excluídos definitivamente.')
    expect(io.rpc).toHaveBeenCalledExactlyOnceWith('delete_customer_atomic', {
      p_id: id, p_confirmation: 'cliente@example.test',
      p_protected_emails: ['admin@example.test', 'segundo@example.test'],
      p_email_hash: hashEmail('cliente@example.test', 'test-secret'),
    })
    expect(io.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(io.rpc.mock.invocationCallOrder[0]).toBeLessThan(io.revalidatePath.mock.invocationCallOrder[0])
  })
  it('preserva mensagem de proteção sem indicar sucesso', async () => {
    io.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Contas de administrador não podem ser excluídas.' } })
    expect(await remove()).toEqual({ error: 'Contas de administrador não podem ser excluídas.' })
    expect(io.revalidatePath).not.toHaveBeenCalled()
  })
  it('trata RPC ausente e não expõe erro interno', async () => {
    io.rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'missing' } })
    expect((await remove()).error).toMatch(/disponível/i)
    io.rpc.mockResolvedValue({ error: { code: 'XX000', message: 'private connection details' } })
    expect((await remove()).error).not.toContain('private')
    expect(io.revalidatePath).not.toHaveBeenCalled()
  })
})
