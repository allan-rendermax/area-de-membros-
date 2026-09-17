'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { decideCustomerLogin, type LoginFailure } from '@/lib/auth/customer-login'
import { verifyTurnstile } from '@/lib/auth/turnstile'
import { findCustomerByEmail, recordDevice } from '@/lib/data/customers'
import { countLoginAttemptsByEmailHash, countLoginAttemptsByIp, recordLoginAttempt } from '@/lib/data/login-attempts'
import { hasPaidOrderInStore } from '@/lib/data/orders'
import { getStoreBySlug } from '@/lib/data/stores'
import { normalizeEmail } from '@/lib/domain/email'
import { env } from '@/lib/env'
import { supportHref } from '@/lib/support/whatsapp'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type EntrarState = { error: string | null; email: string; supportHref: string | null }

const MESSAGES: Record<LoginFailure, string> = {
  bot: 'Não foi possível validar o envio. Recarregue a página e tente novamente.',
  invalid_email: 'Digite um e-mail válido.',
  admin_email: 'Este e-mail é de administrador. Entre por /admin/entrar.',
  not_found: 'Não encontramos compras com este e-mail nesta loja. Confira se é o mesmo e-mail usado na compra.',
  blocked: 'Este acesso está suspenso. Fale com o suporte.',
  rate_limited: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
}

const GENERIC_ERROR = 'Não foi possível entrar agora. Tente novamente em instantes.'

export async function entrar(storeSlug: string, _prev: EntrarState, formData: FormData): Promise<EntrarState> {
  const email = String(formData.get('email') ?? '')
  const store = await getStoreBySlug(storeSlug)
  if (!store) return { error: GENERIC_ERROR, email, supportHref: null }

  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido'
  const userAgent = h.get('user-agent') ?? ''
  const siteKey = env.turnstileSiteKey
  const secretKey = env.turnstileSecretKey

  const decision = await decideCustomerLogin(
    {
      email,
      ip,
      honeypot: String(formData.get('website') ?? ''),
      stamp: String(formData.get('stamp') ?? ''),
      turnstileToken: String(formData.get('cf-turnstile-response') ?? ''),
      storeId: store.id,
    },
    {
      adminEmails: env.adminEmails,
      guardSecret: env.loginGuardSecret,
      now: () => Date.now(),
      countAttemptsByIp: countLoginAttemptsByIp,
      countAttemptsByEmailHash: countLoginAttemptsByEmailHash,
      recordAttempt: recordLoginAttempt,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      verifyTurnstile: siteKey && secretKey ? (token, remoteIp) => verifyTurnstile(token, remoteIp, secretKey) : null,
      findCustomerByEmail,
      hasPaidOrderInStore,
    },
  )

  if (!decision.ok) {
    const context = decision.reason === 'not_found' || decision.reason === 'blocked' ? 'nao_encontrado' : 'geral'
    const typed = normalizeEmail(email)
    return { error: MESSAGES[decision.reason], email, supportHref: supportHref(store, context, typed || null) }
  }

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: decision.email })
  if (error) return { error: GENERIC_ERROR, email, supportHref: null }

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'email', token_hash: data.properties.hashed_token })
  if (verifyError) return { error: GENERIC_ERROR, email, supportHref: null }

  await recordDevice(decision.customerId, userAgent, ip)
  redirect(`/${store.slug}`)
}
