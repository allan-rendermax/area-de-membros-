import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireStoreSession } from '@/lib/membros/session'

const mocks = vi.hoisted(() => ({
  user: vi.fn(), customer: vi.fn(), store: vi.fn(), accepted: vi.fn(),
  eq: vi.fn(), from: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) },
  notFound: () => { throw new Error('NOT_FOUND') },
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.user } }) }))
vi.mock('@/lib/data/customers', () => ({ findCustomerByEmail: mocks.customer }))
vi.mock('@/lib/data/stores', () => ({ getStoreBySlug: mocks.store }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from }) }))

const store = { id: 'store-id', slug: 'arquitetura', name: 'Arquitetura' }
const customer = { id: 'student-id', email: 'student@example.test', blockedAt: null }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user.mockResolvedValue({ data: { user: { email: customer.email } } })
  mocks.customer.mockResolvedValue(customer)
  mocks.store.mockResolvedValue(store)
  const query = { select: vi.fn().mockReturnThis(), eq: mocks.eq, maybeSingle: mocks.accepted }
  mocks.eq.mockReturnValue(query)
  mocks.from.mockReturnValue(query)
  mocks.accepted.mockResolvedValue({ data: null, error: null })
})

describe('aceite antes de carregar conteúdo', () => {
  it('envia aluno sem aceite para boas-vindas antes de devolver sua sessão de conteúdo', async () => {
    await expect(requireStoreSession('arquitetura')).rejects.toThrow('REDIRECT:/arquitetura/boas-vindas')
    expect(mocks.eq).toHaveBeenCalledWith('customer_id', customer.id)
    expect(mocks.eq).toHaveBeenCalledWith('store_id', store.id)
  })
  it('libera o mesmo aluno em qualquer nova sessão quando o banco já tem o aceite', async () => {
    mocks.accepted.mockResolvedValue({ data: { accepted_at: '2026-09-26T12:00:00Z' }, error: null })
    for (let i = 0; i < 2; i++) await expect(requireStoreSession('arquitetura')).resolves.toEqual({ store, customer })
  })
  it('não libera materiais se a consulta do aceite falhar', async () => {
    mocks.accepted.mockResolvedValue({ data: null, error: new Error('database unavailable') })
    await expect(requireStoreSession('arquitetura')).rejects.toThrow('database unavailable')
  })
  it('preserva login e bloqueio antes de consultar aceite', async () => {
    mocks.customer.mockResolvedValue({ ...customer, blockedAt: '2026-09-26' })
    await expect(requireStoreSession('arquitetura')).rejects.toThrow('REDIRECT:/arquitetura/entrar')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('preserva outras lojas', async () => {
    mocks.store.mockResolvedValue({ ...store, slug: 'outra-loja' })
    await expect(requireStoreSession('outra-loja')).resolves.toMatchObject({ customer })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
