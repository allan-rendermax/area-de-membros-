import { normalizeEmail } from '@/lib/domain/email'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

export const env = {
  get supabaseUrl() { return required('NEXT_PUBLIC_SUPABASE_URL') },
  get supabasePublishableKey() { return required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') },
  get supabaseSecretKey() { return required('SUPABASE_SECRET_KEY') },
  get paytIntegrationKey() { return required('PAYT_INTEGRATION_KEY') },
  get resendApiKey() { return required('RESEND_API_KEY') },
  get emailFrom() { return required('EMAIL_FROM') },
  get appUrl() { return required('APP_URL').replace(/\/$/, '') },
  get adminEmails() {
    return required('ADMIN_EMAILS').split(',').map(normalizeEmail).filter(Boolean)
  },
  get defaultStoreSlug() { return required('DEFAULT_STORE_SLUG') },
}
