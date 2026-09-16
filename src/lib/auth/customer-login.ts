import { isAdminEmail } from '@/lib/auth/admin'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'
import type { CustomerRow } from '@/lib/domain/types'

export const LOGIN_ATTEMPT_LIMIT = 20

export type LoginFailure = 'invalid_email' | 'admin_email' | 'not_found' | 'blocked' | 'rate_limited'

export type LoginDecision = { ok: true; email: string; customerId: string } | { ok: false; reason: LoginFailure }

export async function decideCustomerLogin(
  input: { email: string; ip: string },
  deps: {
    adminEmails: string[]
    countRecentAttempts(ip: string): Promise<number>
    recordAttempt(ip: string): Promise<void>
    findCustomerByEmail(email: string): Promise<CustomerRow | null>
  },
): Promise<LoginDecision> {
  if ((await deps.countRecentAttempts(input.ip)) >= LOGIN_ATTEMPT_LIMIT) return { ok: false, reason: 'rate_limited' }
  await deps.recordAttempt(input.ip)

  const email = normalizeEmail(input.email)
  if (!isValidEmail(email)) return { ok: false, reason: 'invalid_email' }
  if (isAdminEmail(email, deps.adminEmails)) return { ok: false, reason: 'admin_email' }

  const customer = await deps.findCustomerByEmail(email)
  if (!customer) return { ok: false, reason: 'not_found' }
  if (customer.blockedAt) return { ok: false, reason: 'blocked' }

  return { ok: true, email, customerId: customer.id }
}
