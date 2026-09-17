import { Resend } from 'resend'
import { env } from '@/lib/env'
import type { EmailTransport } from './notifier'

export function createResendTransport(): EmailTransport {
  const resend = new Resend(env.resendApiKey)
  return {
    async send(email) {
      const { data, error } = await resend.emails.send(email)
      if (error) throw new Error(error.message)
      return { providerId: data?.id ?? null }
    },
  }
}
