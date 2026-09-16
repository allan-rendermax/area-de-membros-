import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const target = new URL(request.url).searchParams.get('para') === 'admin' ? '/admin/entrar' : '/entrar'
  return NextResponse.redirect(new URL(target, request.url), { status: 303 })
}
