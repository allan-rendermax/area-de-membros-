'use server'

import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/auth/admin'
import { normalizeEmail } from '@/lib/domain/email'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export type AdminLoginState = { step: 'email' | 'code'; email: string; error: string | null }

export async function enviarCodigo(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''))
  if (!isAdminEmail(email, env.adminEmails)) return { step: 'email', email, error: 'Email não autorizado.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) return { step: 'email', email, error: 'Não foi possível enviar o código. Tente novamente.' }
  return { step: 'code', email, error: null }
}

export async function verificarCodigo(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''))
  const token = String(formData.get('token') ?? '').replace(/\D/g, '')
  if (!isAdminEmail(email, env.adminEmails)) return { step: 'email', email, error: 'Email não autorizado.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) return { step: 'code', email, error: 'Código inválido ou expirado.' }
  redirect('/admin')
}
