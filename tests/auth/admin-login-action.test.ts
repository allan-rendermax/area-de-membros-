import { redirect } from 'next/navigation'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enviarCodigo, verificarCodigo, type AdminLoginState } from '@/app/admin/entrar/actions'
import { createClient } from '@/lib/supabase/server'

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/lib/env', () => ({ env: { adminEmails: ['admin@example.com'] } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const initial: AdminLoginState = { step: 'email', email: '', error: null }

function form(email: string, token?: string) {
  const data = new FormData()
  data.set('email', email)
  if (token !== undefined) data.set('token', token)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: null })
  auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
  vi.mocked(createClient).mockResolvedValue({ auth } as never)
})

describe('enviarCodigo — privacidade da allowlist', () => {
  it('mostra o passo de código para e-mail desconhecido sem chamar o Supabase', async () => {
    await expect(enviarCodigo(initial, form(' Pessoa@Example.com '))).resolves.toEqual({
      step: 'code', email: 'pessoa@example.com', error: null,
    })
    expect(createClient).not.toHaveBeenCalled()
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('mostra o mesmo estado público para admin autorizado', async () => {
    await expect(enviarCodigo(initial, form(' ADMIN@example.com '))).resolves.toEqual({
      step: 'code', email: 'admin@example.com', error: null,
    })
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'admin@example.com', options: { shouldCreateUser: true },
    })
  })

  it('mantém o passo de código quando o provedor falha', async () => {
    auth.signInWithOtp.mockResolvedValueOnce({ data: {}, error: new Error('provedor indisponível') })

    await expect(enviarCodigo(initial, form('admin@example.com'))).resolves.toEqual({
      step: 'code', email: 'admin@example.com', error: null,
    })
  })

  it('mantém o passo de código quando o provedor rejeita a solicitação', async () => {
    auth.signInWithOtp.mockRejectedValueOnce(new Error('provedor indisponível'))

    await expect(enviarCodigo(initial, form('admin@example.com'))).resolves.toEqual({
      step: 'code', email: 'admin@example.com', error: null,
    })
  })
})

describe('verificarCodigo — privacidade da allowlist', () => {
  it('usa o erro neutro para desconhecido sem chamar o Supabase', async () => {
    await expect(verificarCodigo(initial, form('pessoa@example.com', '12 34-56'))).resolves.toEqual({
      step: 'code', email: 'pessoa@example.com', error: 'Código inválido ou expirado.',
    })
    expect(createClient).not.toHaveBeenCalled()
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  it('usa o mesmo erro neutro quando o Supabase recusa o código do admin', async () => {
    auth.verifyOtp.mockResolvedValueOnce({ data: {}, error: new Error('token inválido') })

    await expect(verificarCodigo(initial, form('admin@example.com', '12 34-56'))).resolves.toEqual({
      step: 'code', email: 'admin@example.com', error: 'Código inválido ou expirado.',
    })
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'admin@example.com', token: '123456', type: 'email' })
  })

  it('usa o erro neutro quando o provedor rejeita a verificação', async () => {
    auth.verifyOtp.mockRejectedValueOnce(new Error('provedor indisponível'))

    await expect(verificarCodigo(initial, form('admin@example.com', '123456'))).resolves.toEqual({
      step: 'code', email: 'admin@example.com', error: 'Código inválido ou expirado.',
    })
  })

  it('redireciona o admin verificado para o painel', async () => {
    await expect(verificarCodigo(initial, form('admin@example.com', '123456'))).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/admin')
  })
})
