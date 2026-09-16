import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/auth/admin'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export async function requireAdmin(): Promise<{ email: string }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email
  if (!email || !isAdminEmail(email, env.adminEmails)) redirect('/admin/entrar')
  return { email }
}
