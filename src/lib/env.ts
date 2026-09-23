import { normalizeEmail } from '@/lib/domain/email'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

export const env = {
  // All Supabase clients run on the server. Keep legacy names as a local fallback.
  get supabaseUrl() { return process.env.SUPABASE_URL || required('NEXT_PUBLIC_SUPABASE_URL') },
  get supabasePublishableKey() { return process.env.SUPABASE_PUBLISHABLE_KEY || required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') },
  get supabaseSecretKey() { return required('SUPABASE_SECRET_KEY') },
  get paytIntegrationKey() { return required('PAYT_INTEGRATION_KEY') },
  get resendApiKey() { return required('RESEND_API_KEY') },
  get emailFrom() { return required('EMAIL_FROM') },
  get emailReplyTo() { return process.env.EMAIL_REPLY_TO?.trim() || undefined },
  get appUrl() { return required('APP_URL').replace(/\/$/, '') },
  get adminEmails() {
    return required('ADMIN_EMAILS').split(',').map(normalizeEmail).filter(Boolean)
  },
  get defaultStoreSlug() { return required('DEFAULT_STORE_SLUG') },
  get emailDailyLimit() {
    const value = Number(process.env.EMAIL_DAILY_LIMIT)
    return Number.isFinite(value) && value > 0 ? value : 100
  },
  get loginGuardSecret() { return required('LOGIN_GUARD_SECRET') },
  get turnstileSiteKey() { return process.env.TURNSTILE_SITE_KEY || null },
  get turnstileSecretKey() { return process.env.TURNSTILE_SECRET_KEY || null },
}
