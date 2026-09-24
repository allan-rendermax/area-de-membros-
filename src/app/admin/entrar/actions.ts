'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { isAdminEmail } from '@/lib/auth/admin'
import { ADMIN_BROWSER_COOKIE, ADMIN_BROWSER_MAX_AGE, createAdminBrowserSession } from '@/lib/auth/admin-browser-session'
import { normalizeEmail } from '@/lib/domain/email'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export type AdminLoginState = { step: 'email' | 'code'; email: string; error: string | null }

export async function enviarCodigo(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''))
  if (!isAdminEmail(email, env.adminEmails)) return { step: 'code', email, error: null }

  try {
    const supabase = await createClient('admin')
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  } catch {
    return { step: 'code', email, error: null }
  }
  return { step: 'code', email, error: null }
}

export async function verificarCodigo(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''))
  const token = String(formData.get('token') ?? '').replace(/\D/g, '')
  if (!isAdminEmail(email, env.adminEmails)) return { step: 'code', email, error: 'Código inválido ou expirado.' }

  try {
    const supabase = await createClient('admin')
    const { data: verified, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error || !verified.user?.id || !verified.session?.access_token) {
      return { step: 'code', email, error: 'Código inválido ou expirado.' }
    }
    const { data, error: claimsError } = await supabase.auth.getClaims(verified.session.access_token)
    const userId = data?.claims.sub
    const sessionId = data?.claims.session_id
    if (claimsError || userId !== verified.user.id || typeof sessionId !== 'string' || !sessionId) {
      return { step: 'code', email, error: 'Código inválido ou expirado.' }
    }
    const rememberBrowser = formData.get('rememberBrowser') === 'on'
    const value = createAdminBrowserSession(userId, sessionId, env.loginGuardSecret)
    ;(await cookies()).set(ADMIN_BROWSER_COOKIE, value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      ...(rememberBrowser ? { maxAge: ADMIN_BROWSER_MAX_AGE } : {}),
    })
  } catch {
    return { step: 'code', email, error: 'Código inválido ou expirado.' }
  }
  redirect('/admin')
}
