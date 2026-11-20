import { NextResponse, type NextRequest } from 'next/server'
import { isValidStoreSlug } from '@/lib/content/slug'
import { listAllOrderRefsByEmail } from '@/lib/data/orders'
import { loginUrlFor } from '@/lib/email/notifier'
import { env } from '@/lib/env'
import {
  LAST_CHANCE_COOKIE,
  LAST_CHANCE_COOKIE_MAX_AGE,
  LAST_CHANCE_RULES,
  lastChanceTarget,
} from '@/lib/membros/last-chance'

export const dynamic = 'force-dynamic'

// Link do e-mail de acesso. Nunca bloqueia: na dúvida, vai para o login.
export async function GET(request: NextRequest, { params }: { params: Promise<{ loja: string }> }) {
  const { loja } = await params
  if (!isValidStoreSlug(loja)) return new Response('Not found', { status: 404 })
  const email = (request.nextUrl.searchParams.get('email') ?? '').trim()
  const login = loginUrlFor(env.appUrl, loja, email)
  const rule = LAST_CHANCE_RULES[loja]

  if (!rule || !email || request.cookies.get(LAST_CHANCE_COOKIE)) return NextResponse.redirect(login)

  let target: string | null = null
  try {
    const orders = await listAllOrderRefsByEmail(email)
    const paid = orders.filter((o) => o.status === 'pago').map((o) => o.productCode)
    target = lastChanceTarget(rule, paid, login)
  } catch {
    target = null
  }
  if (!target) return NextResponse.redirect(login)

  const response = NextResponse.redirect(target)
  response.cookies.set(LAST_CHANCE_COOKIE, '1', {
    maxAge: LAST_CHANCE_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: true,
    httpOnly: true,
  })
  return response
}
