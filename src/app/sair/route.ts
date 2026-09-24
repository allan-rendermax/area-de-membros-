import { NextResponse } from 'next/server'
import { ADMIN_BROWSER_COOKIE } from '@/lib/auth/admin-browser-session'
import { isValidStoreSlug } from '@/lib/content/slug'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const params = new URL(request.url).searchParams
  const isAdmin = params.get('para') === 'admin'
  const supabase = await createClient(isAdmin ? 'admin' : 'member')
  await supabase.auth.signOut({ scope: 'local' })
  const loja = params.get('loja')
  const target =
    isAdmin
      ? '/admin/entrar'
      : `/${loja && isValidStoreSlug(loja) ? loja : env.defaultStoreSlug}/entrar`
  const response = NextResponse.redirect(new URL(target, request.url), { status: 303 })
  if (isAdmin) response.cookies.set(ADMIN_BROWSER_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}
