import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { isAdminEmail } from '@/lib/auth/admin'
import { ADMIN_BROWSER_COOKIE, isAdminBrowserSessionValid } from '@/lib/auth/admin-browser-session'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export async function getAdminSession(): Promise<{ email: string } | null> {
  const browserSession = (await cookies()).get(ADMIN_BROWSER_COOKIE)?.value
  if (!browserSession) return null
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  const email = data.user?.email
  if (error || !email || !isAdminEmail(email, env.adminEmails)) return null
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (claimsError || claims?.sub !== data.user.id || typeof claims?.session_id !== 'string') return null
  if (!isAdminBrowserSessionValid(browserSession, data.user.id, claims.session_id, env.loginGuardSecret)) return null
  return { email }
}

export async function requireAdmin(): Promise<{ email: string }> {
  const admin = await getAdminSession()
  if (!admin) redirect('/admin/entrar')
  return admin
}
