import { describe, expect, it } from 'vitest'
import { isAdminEmail } from '@/lib/auth/admin'
import { decideCustomerLogin, LOGIN_ATTEMPT_LIMIT } from '@/lib/auth/customer-login'
import type { CustomerRow } from '@/lib/domain/types'

function deps(overrides: { attempts?: number; customers?: CustomerRow[] } = {}) {
  const recorded: string[] = []
  const customers = overrides.customers ?? [{ id: 'c1', email: 'joao@gmail.com', name: 'João', blockedAt: null }]
  return {
    recorded,
    deps: {
      adminEmails: ['dono@gmail.com'],
      countRecentAttempts: async () => overrides.attempts ?? 0,
      recordAttempt: async (ip: string) => { recorded.push(ip) },
      findCustomerByEmail: async (email: string) => customers.find((c) => c.email === email) ?? null,
    },
  }
}

describe('decideCustomerLogin', () => {
  it('entra com email de cliente, normalizando', async () => {
    const { deps: d, recorded } = deps()
    expect(await decideCustomerLogin({ email: ' JOAO@gmail.com ', ip: '1.1.1.1' }, d)).toEqual({
      ok: true, email: 'joao@gmail.com', customerId: 'c1',
    })
    expect(recorded).toEqual(['1.1.1.1'])
  })

  it('recusa email inválido', async () => {
    expect(await decideCustomerLogin({ email: 'joao', ip: 'x' }, deps().deps)).toEqual({ ok: false, reason: 'invalid_email' })
  })

  it('recusa email de admin', async () => {
    expect(await decideCustomerLogin({ email: 'Dono@gmail.com', ip: 'x' }, deps().deps)).toEqual({ ok: false, reason: 'admin_email' })
  })

  it('recusa email sem compras', async () => {
    expect(await decideCustomerLogin({ email: 'maria@gmail.com', ip: 'x' }, deps().deps)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('recusa cliente bloqueado', async () => {
    const d = deps({ customers: [{ id: 'c1', email: 'joao@gmail.com', name: '', blockedAt: '2026-09-16T00:00:00Z' }] }).deps
    expect(await decideCustomerLogin({ email: 'joao@gmail.com', ip: 'x' }, d)).toEqual({ ok: false, reason: 'blocked' })
  })

  it('bloqueia após o limite de tentativas sem registrar nova', async () => {
    const { deps: d, recorded } = deps({ attempts: LOGIN_ATTEMPT_LIMIT })
    expect(await decideCustomerLogin({ email: 'joao@gmail.com', ip: 'x' }, d)).toEqual({ ok: false, reason: 'rate_limited' })
    expect(recorded).toEqual([])
  })
})

describe('isAdminEmail', () => {
  it('compara normalizado', () => {
    expect(isAdminEmail(' DONO@gmail.com', ['dono@gmail.com'])).toBe(true)
    expect(isAdminEmail('joao@gmail.com', ['dono@gmail.com'])).toBe(false)
  })
})
