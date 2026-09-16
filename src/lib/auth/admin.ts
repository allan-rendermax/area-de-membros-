import { normalizeEmail } from '@/lib/domain/email'

export function isAdminEmail(email: string, adminEmails: string[]): boolean {
  return adminEmails.includes(normalizeEmail(email))
}
