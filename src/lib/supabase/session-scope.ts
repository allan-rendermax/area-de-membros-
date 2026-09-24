import { env } from '@/lib/env'

export type SessionScope = 'member' | 'admin'

export function sessionCookieOptions(scope: SessionScope) {
  // Keep existing member cookies; admin authentication must survive student
  // login/logout in another tab on the same domain.
  if (scope === 'member') return undefined
  const project = new URL(env.supabaseUrl).hostname.split('.')[0]
  return {
    name: `sb-${project}-admin-auth-token`,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  }
}
