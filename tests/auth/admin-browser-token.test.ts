import { describe, expect, it } from 'vitest'
import { createAdminBrowserSession, isAdminBrowserSessionValid } from '@/lib/auth/admin-browser-session'

const issuedAt = Date.UTC(2026, 8, 23, 12)

describe('admin browser token', () => {
  it('expires at the exact seven-day boundary without extending on validation', () => {
    const token = createAdminBrowserSession('user-a', 'session-a', 'secret-a', issuedAt)
    expect(isAdminBrowserSessionValid(token, 'user-a', 'session-a', 'secret-a', issuedAt + 604799999)).toBe(true)
    expect(isAdminBrowserSessionValid(token, 'user-a', 'session-a', 'secret-a', issuedAt + 604800000)).toBe(false)
  })

  it('binds the confirmation to the user, Supabase session and signing secret', () => {
    const token = createAdminBrowserSession('user-a', 'session-a', 'secret-a', issuedAt)
    expect(isAdminBrowserSessionValid(token, 'user-a', 'session-b', 'secret-a', issuedAt)).toBe(false)
    expect(isAdminBrowserSessionValid(token, 'user-b', 'session-a', 'secret-a', issuedAt)).toBe(false)
    expect(isAdminBrowserSessionValid(token, 'user-a', 'session-a', 'secret-b', issuedAt)).toBe(false)
  })

  it('rejects a confirmation issued in the future', () => {
    const token = createAdminBrowserSession('user-a', 'session-a', 'secret-a', issuedAt)
    expect(isAdminBrowserSessionValid(token, 'user-a', 'session-a', 'secret-a', issuedAt - 1)).toBe(false)
  })

  it.each(['', '.', 'NaN.x', 'Infinity.x', '1.x.extra'])('rejects malformed token %j', (token) => {
    expect(isAdminBrowserSessionValid(token, 'user-a', 'session-a', 'secret-a', issuedAt)).toBe(false)
  })
})
