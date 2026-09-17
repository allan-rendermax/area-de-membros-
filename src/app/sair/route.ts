import { NextResponse } from 'next/server'
import { isValidStoreSlug } from '@/lib/content/slug'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const params = new URL(request.url).searchParams
  const loja = params.get('loja')
  const target =
    params.get('para') === 'admin'
      ? '/admin/entrar'
      : `/${loja && isValidStoreSlug(loja) ? loja : env.defaultStoreSlug}/entrar`
  return NextResponse.redirect(new URL(target, request.url), { status: 303 })
}
