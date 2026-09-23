import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_BROWSER_COOKIE = 'admin-browser-session'
export const ADMIN_BROWSER_MAX_AGE = 7 * 24 * 60 * 60

function signature(issuedAt: number, userId: string, sessionId: string, secret: string) {
  return createHmac('sha256', secret)
    .update(JSON.stringify(['admin-browser-session:v1', issuedAt, userId, sessionId]))
    .digest('base64url')
}

export function createAdminBrowserSession(userId: string, sessionId: string, secret: string, now = Date.now()) {
  return `${now}.${signature(now, userId, sessionId, secret)}`
}

// A renovação do token Supabase não prolonga o prazo da confirmação por e-mail.
export function isAdminBrowserSessionValid(
  value: string, userId: string, sessionId: string, secret: string, now = Date.now(),
): boolean {
  const parts = value.split('.')
  if (parts.length !== 2 || !parts[0] || !userId || !sessionId) return false
  const issuedAt = Number(parts[0])
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now || now - issuedAt >= ADMIN_BROWSER_MAX_AGE * 1000) return false
  const expected = Buffer.from(signature(issuedAt, userId, sessionId, secret))
  const received = Buffer.from(parts[1])
  return expected.length === received.length && timingSafeEqual(expected, received)
}
