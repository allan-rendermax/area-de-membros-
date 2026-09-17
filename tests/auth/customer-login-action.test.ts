import { describe, expect, it, vi } from 'vitest'
import { entrar } from '@/app/[loja]/entrar/actions'
import { decideCustomerLogin } from '@/lib/auth/customer-login'
import { supportHref } from '@/lib/support/whatsapp'

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/auth/customer-login', () => ({ decideCustomerLogin: vi.fn() }))
vi.mock('@/lib/auth/turnstile', () => ({ verifyTurnstile: vi.fn() }))
vi.mock('@/lib/data/customers', () => ({ findCustomerByEmail: vi.fn(), recordDevice: vi.fn() }))
vi.mock('@/lib/data/login-attempts', () => ({
  countLoginAttemptsByEmailHash: vi.fn(),
  countLoginAttemptsByIp: vi.fn(),
  recordLoginAttempt: vi.fn(),
}))
vi.mock('@/lib/data/orders', () => ({ hasPaidOrderInStore: vi.fn() }))
vi.mock('@/lib/data/stores', () => ({
  getStoreBySlug: async () => ({
    id: 's1', slug: 'arquitetura', name: 'Arquitetura',
    supportWhatsapp: '5511999998888', supportUrl: null,
  }),
}))
vi.mock('@/lib/env', () => ({
  env: { adminEmails: [], loginGuardSecret: 'segredo', turnstileSiteKey: null, turnstileSecretKey: null },
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

async function submit(reason: 'admin_email' | 'not_found') {
  vi.mocked(decideCustomerLogin).mockResolvedValueOnce({ ok: false, reason })
  const formData = new FormData()
  formData.set('email', ' DONO@gmail.com ')
  return entrar('arquitetura', { error: null, email: '', supportHref: null }, formData)
}

describe('entrar — privacidade do e-mail de administrador', () => {
  it('exibe a mesma mensagem para admin_email e not_found', async () => {
    const notFound = await submit('not_found')
    const admin = await submit('admin_email')
    expect(notFound.error).toBe('Não encontramos compras com este e-mail nesta loja. Confira se é o mesmo e-mail usado na compra.')
    expect(admin.error).toBe(notFound.error)
  })

  it('usa o contexto nao_encontrado também para admin_email', async () => {
    const notFound = await submit('not_found')
    const admin = await submit('admin_email')
    expect(admin.supportHref).toBe(supportHref({
      name: 'Arquitetura', supportWhatsapp: '5511999998888', supportUrl: null,
    }, 'nao_encontrado', 'dono@gmail.com'))
    expect(admin.supportHref).toBe(notFound.supportHref)
  })
})
