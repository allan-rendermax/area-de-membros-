import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { protectedStoreSlug } from '@/lib/membros/paths'
import { sessionCookieOptions } from './session-scope'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const path = request.nextUrl.pathname
  const storeSlug = protectedStoreSlug(path)
  const isStorePreview = Boolean(storeSlug) && request.nextUrl.searchParams.get('previa') === '1'
  const isAdminPath = path === '/admin' || path.startsWith('/admin/')
  const isAdminLogout = path === '/sair' && request.nextUrl.searchParams.get('para') === 'admin'

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookieOptions: sessionCookieOptions(isAdminPath || isAdminLogout || isStorePreview ? 'admin' : 'member'),
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
  })

  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims)

  const needsAdmin = (isAdminPath && path !== '/admin/entrar') || isStorePreview

  if (!signedIn && (storeSlug || needsAdmin)) {
    const url = request.nextUrl.clone()
    url.pathname = needsAdmin ? '/admin/entrar' : `/${storeSlug}/entrar`
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
