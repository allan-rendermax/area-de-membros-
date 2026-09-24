import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import { sessionCookieOptions, type SessionScope } from './session-scope'

export async function createClient(scope: SessionScope = 'member') {
  const cookieStore = await cookies()
  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookieOptions: sessionCookieOptions(scope),
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado a partir de Server Component: o proxy renova a sessão.
        }
      },
    },
  })
}
