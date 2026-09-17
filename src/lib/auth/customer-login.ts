import { isAdminEmail } from '@/lib/auth/admin'
import { checkFormStamp, GUARD, hashEmail, progressiveDelayMs } from '@/lib/auth/login-guard'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'
import type { CustomerRow } from '@/lib/domain/types'

export type LoginFailure = 'bot' | 'invalid_email' | 'admin_email' | 'not_found' | 'blocked' | 'rate_limited'

export type LoginDecision = { ok: true; email: string; customerId: string } | { ok: false; reason: LoginFailure }

export type LoginInput = {
  email: string
  ip: string
  honeypot: string
  stamp: string
  turnstileToken: string
  storeId: string
}

export type LoginDeps = {
  adminEmails: string[]
  guardSecret: string
  now(): number
  countAttemptsByIp(ip: string, sinceIso: string): Promise<number>
  countAttemptsByEmailHash(hash: string, sinceIso: string): Promise<number>
  recordAttempt(entry: { ip: string; emailHash: string | null; storeId: string }): Promise<void>
  sleep(ms: number): Promise<void>
  verifyTurnstile: ((token: string, ip: string) => Promise<boolean>) | null
  findCustomerByEmail(email: string): Promise<CustomerRow | null>
  hasPaidOrderInStore(email: string, storeId: string): Promise<boolean>
}

export async function decideCustomerLogin(input: LoginInput, deps: LoginDeps): Promise<LoginDecision> {
  if (input.honeypot.trim() !== '') return { ok: false, reason: 'bot' }
  if (checkFormStamp(input.stamp, deps.now(), deps.guardSecret) !== 'ok') return { ok: false, reason: 'bot' }

  const since = new Date(deps.now() - GUARD.windowMinutes * 60_000).toISOString()
  if ((await deps.countAttemptsByIp(input.ip, since)) >= GUARD.ipLimit) return { ok: false, reason: 'rate_limited' }

  const email = normalizeEmail(input.email)
  if (!isValidEmail(email)) {
    await deps.recordAttempt({ ip: input.ip, emailHash: null, storeId: input.storeId })
    return { ok: false, reason: 'invalid_email' }
  }

  const emailHash = hashEmail(email, deps.guardSecret)
  const previous = await deps.countAttemptsByEmailHash(emailHash, since)
  if (previous >= GUARD.emailLimit) return { ok: false, reason: 'rate_limited' }
  await deps.recordAttempt({ ip: input.ip, emailHash, storeId: input.storeId })

  const delay = progressiveDelayMs(previous)
  if (delay > 0) await deps.sleep(delay)

  if (deps.verifyTurnstile && !(await deps.verifyTurnstile(input.turnstileToken, input.ip))) return { ok: false, reason: 'bot' }
  if (isAdminEmail(email, deps.adminEmails)) return { ok: false, reason: 'admin_email' }

  const customer = await deps.findCustomerByEmail(email)
  if (!customer || !(await deps.hasPaidOrderInStore(email, input.storeId))) return { ok: false, reason: 'not_found' }
  if (customer.blockedAt) return { ok: false, reason: 'blocked' }

  return { ok: true, email, customerId: customer.id }
}
