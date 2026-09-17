'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { decideCustomerLogin, type LoginFailure } from '@/lib/auth/customer-login'
import { countRecentLoginAttempts, findCustomerByEmail, recordDevice, recordLoginAttempt } from '@/lib/data/customers'
import { getStoreBySlug } from '@/lib/data/stores'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type EntrarState = { error: string | null; email: string }

const MESSAGES: Record<LoginFailure, string> = {
  invalid_email: 'Digite um e-mail válido.',
  admin_email: 'Este e-mail é de administrador. Entre por /admin/entrar.',
  not_found: 'Não encontramos compras com este e-mail. Confira se é o mesmo e-mail usado na compra.',
  blocked: 'Este acesso está suspenso. Fale com o suporte.',
  rate_limited: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
}

const GENERIC_ERROR = 'Não foi possível entrar agora. Tente novamente em instantes.'

export async function entrar(storeSlug: string, _prev: EntrarState, formData: FormData): Promise<EntrarState> {
  const email = String(formData.get('email') ?? '')
  const store = await getStoreBySlug(storeSlug)
  if (!store) return { error: GENERIC_ERROR, email }

  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido'
  const userAgent = h.get('user-agent') ?? ''

  const decision = await decideCustomerLogin(
    { email, ip },
    { adminEmails: env.adminEmails, countRecentAttempts: countRecentLoginAttempts, recordAttempt: recordLoginAttempt, findCustomerByEmail },
  )
  if (!decision.ok) return { error: MESSAGES[decision.reason], email }

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: decision.email })
  if (error) return { error: GENERIC_ERROR, email }

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'email', token_hash: data.properties.hashed_token })
  if (verifyError) return { error: GENERIC_ERROR, email }

  await recordDevice(decision.customerId, userAgent, ip)
  redirect(`/${store.slug}`)
}
