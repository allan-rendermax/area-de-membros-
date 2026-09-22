import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notFound, redirect } from 'next/navigation'
import { findCustomerByEmail } from '@/lib/data/customers'
import { getStoreBySlug } from '@/lib/data/stores'
import type { CustomerRow, Store } from '@/lib/domain/types'
import { requireStoreSession } from '@/lib/membros/session'
import { createClient } from '@/lib/supabase/server'

vi.mock('next/navigation', () => ({ notFound: vi.fn(), redirect: vi.fn() }))
vi.mock('@/lib/data/customers', () => ({ findCustomerByEmail: vi.fn() }))
vi.mock('@/lib/data/stores', () => ({ getStoreBySlug: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const store: Store = {
  id: 'store-a',
  slug: 'loja-a',
  name: 'Loja A',
  logoUrl: null,
  supportUrl: null,
  supportWhatsapp: null,
  loginImageUrl: null,
}

const customer: CustomerRow = {
  id: 'customer-a',
  email: 'aluna@example.com',
  name: 'Aluna',
  blockedAt: null,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function authClient(email: string | null = customer.email) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: email ? { email } : null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }
}

describe('requireStoreSession', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(notFound).mockImplementation(() => { throw new Error('NEXT_NOT_FOUND') })
    vi.mocked(redirect).mockImplementation((path) => { throw new Error(`NEXT_REDIRECT:${path}`) })
    vi.mocked(getStoreBySlug).mockResolvedValue(store)
    vi.mocked(findCustomerByEmail).mockResolvedValue(customer)
  })

  it('inicia a verificação autenticada enquanto a loja ainda está carregando', async () => {
    const pendingStore = deferred<Store | null>()
    const supabase = authClient()
    vi.mocked(getStoreBySlug).mockReturnValueOnce(pendingStore.promise)
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = requireStoreSession(store.slug)
    await Promise.resolve()
    await Promise.resolve()

    expect(supabase.auth.getUser).toHaveBeenCalledOnce()
    expect(findCustomerByEmail).not.toHaveBeenCalled()

    pendingStore.resolve(store)
    await expect(result).resolves.toEqual({ store, customer })
    expect(findCustomerByEmail).toHaveBeenCalledWith(customer.email)
  })

  it('redireciona visitante para a entrada da loja', async () => {
    const supabase = authClient(null)
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await expect(requireStoreSession(store.slug)).rejects.toThrow(`NEXT_REDIRECT:/${store.slug}/entrar`)
    expect(findCustomerByEmail).not.toHaveBeenCalled()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it('encerra a sessão de cliente ausente ou bloqueado antes de redirecionar', async () => {
    for (const found of [null, { ...customer, blockedAt: '2026-09-22' }]) {
      const supabase = authClient()
      vi.mocked(createClient).mockResolvedValueOnce(supabase as never)
      vi.mocked(findCustomerByEmail).mockResolvedValueOnce(found)

      await expect(requireStoreSession(store.slug)).rejects.toThrow(`NEXT_REDIRECT:/${store.slug}/entrar`)
      expect(supabase.auth.signOut).toHaveBeenCalledOnce()
    }
  })

  it('responde 404 para slug inválido ou loja ausente', async () => {
    vi.mocked(createClient).mockResolvedValue(authClient() as never)

    await expect(requireStoreSession('Admin')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(getStoreBySlug).not.toHaveBeenCalled()

    vi.mocked(getStoreBySlug).mockResolvedValueOnce(null)
    await expect(requireStoreSession('sem-loja')).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('propaga falhas de loja, autenticação e cliente', async () => {
    vi.mocked(createClient).mockResolvedValue(authClient() as never)
    vi.mocked(getStoreBySlug).mockRejectedValueOnce(new Error('lojas indisponíveis'))
    await expect(requireStoreSession(store.slug)).rejects.toThrow('lojas indisponíveis')

    const authFailure = authClient()
    authFailure.auth.getUser.mockRejectedValueOnce(new Error('auth indisponível'))
    vi.mocked(createClient).mockResolvedValueOnce(authFailure as never)
    await expect(requireStoreSession(store.slug)).rejects.toThrow('auth indisponível')

    vi.mocked(createClient).mockResolvedValueOnce(authClient() as never)
    vi.mocked(findCustomerByEmail).mockRejectedValueOnce(new Error('clientes indisponíveis'))
    await expect(requireStoreSession(store.slug)).rejects.toThrow('clientes indisponíveis')
  })
})
