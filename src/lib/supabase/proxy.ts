import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims)
  const path = request.nextUrl.pathname

  const needsCustomer = path === '/'
  const needsAdmin = path.startsWith('/admin') && !path.startsWith('/admin/entrar')

  if (!signedIn && (needsCustomer || needsAdmin)) {
    const url = request.nextUrl.clone()
    url.pathname = needsAdmin ? '/admin/entrar' : '/entrar'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
