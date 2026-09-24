import { hashEmail } from '@/lib/auth/login-guard'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

export async function deleteCustomer(input: { id: string; confirmation: string; adminEmail: string }): Promise<void> {
  const protectedEmails = [...new Set([...env.adminEmails, input.adminEmail])]
  const { error } = await createAdminClient().rpc('delete_customer_atomic', {
    p_id: input.id,
    p_confirmation: input.confirmation,
    p_protected_emails: protectedEmails,
    p_email_hash: hashEmail(input.confirmation, env.loginGuardSecret),
  })
  if (!error) return
  if (error.code === 'PGRST202' || error.code === '42883') {
    throw new Error('A exclusão de clientes ainda não está disponível. Atualize a página em instantes.')
  }
  if (error.code === 'P0001') throw new Error(error.message)
  throw new Error('Não foi possível confirmar a exclusão. Recarregue a lista de clientes antes de tentar novamente.')
}
