import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const GUARD = {
  minFillMs: 1500,
  maxFormAgeMs: 2 * 60 * 60 * 1000,
  ipLimit: 20,
  emailLimit: 5,
  windowMinutes: 10,
  delayFromAttempt: 3,
  delayStepMs: 700,
  maxDelayMs: 3000,
} as const

function mac(issuedAtMs: number, secret: string): string {
  return createHmac('sha256', secret).update(String(issuedAtMs)).digest('hex')
}

export function signFormStamp(issuedAtMs: number, secret: string): string {
  return `${issuedAtMs}.${mac(issuedAtMs, secret)}`
}

export function freshFormStamp(secret: string): string {
  return signFormStamp(Date.now(), secret)
}

export function checkFormStamp(stamp: string, nowMs: number, secret: string): 'ok' | 'too_fast' | 'invalid' {
  const parts = stamp.split('.')
  if (parts.length !== 2) return 'invalid'
  const issuedAt = Number(parts[0])
  if (!parts[0] || !Number.isSafeInteger(issuedAt)) return 'invalid'

  const expected = Buffer.from(mac(issuedAt, secret))
  const received = Buffer.from(parts[1])
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return 'invalid'

  const age = nowMs - issuedAt
  if (age < 0 || age > GUARD.maxFormAgeMs) return 'invalid'
  return age < GUARD.minFillMs ? 'too_fast' : 'ok'
}

export function hashEmail(email: string, secret: string): string {
  return createHash('sha256').update(`${secret}:${email}`).digest('hex')
}

export function progressiveDelayMs(previousAttempts: number): number {
  const over = previousAttempts + 1 - GUARD.delayFromAttempt
  return over < 0 ? 0 : Math.min(GUARD.maxDelayMs, (over + 1) * GUARD.delayStepMs)
}
