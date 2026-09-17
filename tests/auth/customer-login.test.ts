import { describe, expect, it } from 'vitest'
import { isAdminEmail } from '@/lib/auth/admin'
import { decideCustomerLogin, type LoginDeps, type LoginInput } from '@/lib/auth/customer-login'
import { GUARD, hashEmail, signFormStamp } from '@/lib/auth/login-guard'
import type { CustomerRow } from '@/lib/domain/types'

const SECRET = 'segredo'
const NOW = 1_800_000_000_000
const joao: CustomerRow = { id: 'c1', email: 'joao@gmail.com', name: 'João', blockedAt: null }

function input(extra: Partial<LoginInput> = {}): LoginInput {
  return {
    email: 'joao@gmail.com', ip: '1.1.1.1', honeypot: '', stamp: signFormStamp(NOW - 5_000, SECRET),
    turnstileToken: '', storeId: 's1', ...extra,
  }
}

function setup(o: { ipAttempts?: number; emailAttempts?: number; customers?: CustomerRow[]; paidIn?: string[]; turnstile?: boolean } = {}) {
  const recorded: { ip: string; emailHash: string | null; storeId: string }[] = []
  const slept: number[] = []
  const calls = { countAttemptsByEmailHash: 0 }
  const customers = o.customers ?? [joao]
  const deps: LoginDeps = {
    adminEmails: ['dono@gmail.com'],
    guardSecret: SECRET,
    now: () => NOW,
    countAttemptsByIp: async () => o.ipAttempts ?? 0,
    countAttemptsByEmailHash: async () => {
      calls.countAttemptsByEmailHash += 1
      return o.emailAttempts ?? 0
    },
    recordAttempt: async (entry) => {
      recorded.push(entry)
    },
    sleep: async (ms) => {
      slept.push(ms)
    },
    verifyTurnstile: o.turnstile === undefined ? null : async () => o.turnstile as boolean,
    findCustomerByEmail: async (email) => customers.find((c) => c.email === email) ?? null,
    hasPaidOrderInStore: async (email, storeId) => (o.paidIn ?? ['joao@gmail.com|s1']).includes(`${email}|${storeId}`),
  }
  return { deps, recorded, slept, calls }
}

describe('decideCustomerLogin', () => {
  it('entra com e-mail de cliente que comprou na loja, normalizando', async () => {
    const { deps, recorded } = setup()
    expect(await decideCustomerLogin(input({ email: ' JOAO@gmail.com ' }), deps)).toEqual({ ok: true, email: 'joao@gmail.com', customerId: 'c1' })
    expect(recorded).toEqual([{ ip: '1.1.1.1', emailHash: hashEmail('joao@gmail.com', SECRET), storeId: 's1' }])
  })

  it('campo-armadilha preenchido é robô e não registra tentativa', async () => {
    const { deps, recorded } = setup()
    expect(await decideCustomerLogin(input({ honeypot: 'http://spam' }), deps)).toEqual({ ok: false, reason: 'bot' })
    expect(recorded).toEqual([])
  })

  it('envio rápido demais ou carimbo inválido é robô', async () => {
    const { deps } = setup()
    expect(await decideCustomerLogin(input({ stamp: signFormStamp(NOW - 200, SECRET) }), deps)).toEqual({ ok: false, reason: 'bot' })
    expect(await decideCustomerLogin(input({ stamp: 'x' }), deps)).toEqual({ ok: false, reason: 'bot' })
  })

  it('bloqueia por IP depois do limite sem registrar', async () => {
    const { deps, recorded } = setup({ ipAttempts: GUARD.ipLimit })
    expect(await decideCustomerLogin(input(), deps)).toEqual({ ok: false, reason: 'rate_limited' })
    expect(recorded).toEqual([])
  })

  it('recusa e-mail inválido registrando a tentativa sem hash', async () => {
    const { deps, recorded } = setup()
    expect(await decideCustomerLogin(input({ email: 'joao' }), deps)).toEqual({ ok: false, reason: 'invalid_email' })
    expect(recorded).toEqual([{ ip: '1.1.1.1', emailHash: null, storeId: 's1' }])
  })

  it('bloqueia por e-mail depois do limite', async () => {
    const { deps } = setup({ emailAttempts: GUARD.emailLimit })
    expect(await decideCustomerLogin(input(), deps)).toEqual({ ok: false, reason: 'rate_limited' })
  })

  it('atrasa a partir da 3ª tentativa do mesmo e-mail', async () => {
    const first = setup({ emailAttempts: 0 })
    await decideCustomerLogin(input(), first.deps)
    expect(first.slept).toEqual([])
    const third = setup({ emailAttempts: 2 })
    await decideCustomerLogin(input(), third.deps)
    expect(third.slept).toEqual([700])
  })

  it('Turnstile ligado recusa token inválido e aceita válido', async () => {
    expect(await decideCustomerLogin(input(), setup({ turnstile: false }).deps)).toEqual({ ok: false, reason: 'bot' })
    expect(await decideCustomerLogin(input(), setup({ turnstile: true }).deps)).toMatchObject({ ok: true })
  })

  it.each([2, GUARD.emailLimit])('Turnstile inválido conta só para o IP, sem consultar o e-mail nem atrasar (%i tentativas)', async (emailAttempts) => {
    const { deps, recorded, slept, calls } = setup({ turnstile: false, emailAttempts })
    expect(await decideCustomerLogin(input(), deps)).toEqual({ ok: false, reason: 'bot' })
    expect(recorded).toEqual([{ ip: '1.1.1.1', emailHash: null, storeId: 's1' }])
    expect(calls.countAttemptsByEmailHash).toBe(0)
    expect(slept).toEqual([])
  })

  it('recusa e-mail de admin', async () => {
    expect(await decideCustomerLogin(input({ email: 'Dono@gmail.com' }), setup().deps)).toEqual({ ok: false, reason: 'admin_email' })
  })

  it('recusa quem não existe ou não comprou nesta loja', async () => {
    expect(await decideCustomerLogin(input({ email: 'maria@gmail.com' }), setup().deps)).toEqual({ ok: false, reason: 'not_found' })
    expect(await decideCustomerLogin(input(), setup({ paidIn: [] }).deps)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('recusa cliente bloqueado', async () => {
    const { deps } = setup({ customers: [{ ...joao, blockedAt: '2026-09-16T00:00:00Z' }] })
    expect(await decideCustomerLogin(input(), deps)).toEqual({ ok: false, reason: 'blocked' })
  })
})

describe('isAdminEmail', () => {
  it('compara normalizado', () => {
    expect(isAdminEmail(' DONO@gmail.com', ['dono@gmail.com'])).toBe(true)
    expect(isAdminEmail('joao@gmail.com', ['dono@gmail.com'])).toBe(false)
  })
})
