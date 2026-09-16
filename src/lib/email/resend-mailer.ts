import { Resend } from 'resend'
import { env } from '@/lib/env'
import type { Mailer } from '@/lib/orders/process-postback'
import { accessGrantedEmail } from './templates'

export function createResendMailer(): Mailer {
  const resend = new Resend(env.resendApiKey)
  return {
    async sendAccessGranted(input) {
      const loginUrl = `${env.appUrl}/entrar?email=${encodeURIComponent(input.to)}`
      const { subject, html } = accessGrantedEmail({ ...input, loginUrl })
      const { error } = await resend.emails.send({ from: env.emailFrom, to: input.to, subject, html })
      if (error) throw new Error(error.message)
    },
  }
}
