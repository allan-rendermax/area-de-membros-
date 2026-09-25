import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { verificarCodigo } from '@/app/admin/entrar/actions'
import { salvarProduto } from '@/app/admin/(painel)/produtos/actions'
import { POST as logout } from '@/app/sair/route'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireStoreSession } from '@/lib/membros/session'
import { createClient } from '@/lib/supabase/server'
import { updateSession } from '@/lib/supabase/proxy'

// Keep the actual Supabase SDK and cookie adapter: mocking createClient hid
// the shared storage key that let a student login replace the admin session.
const state = vi.hoisted(() => ({
  jar: new Map<string, { value: string; options: Record<string, unknown> }>(),
  saved: [] as string[],
  logoutScopes: [] as string[],
}))
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (name: string) => state.jar.get(name),
  getAll: () => [...state.jar].map(([name, cookie]) => ({ name, value: cookie.value })),
  set: (name: string, value: string, options: Record<string, unknown>) => {
    if (options.maxAge === 0) state.jar.delete(name)
    else state.jar.set(name, { value, options })
  },
}) }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`) },
  notFound: () => { throw new Error('notFound') },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: {
  supabaseUrl: 'https://session-test.supabase.co', supabasePublishableKey: 'test-key',
  adminEmails: ['admin@example.com'], loginGuardSecret: 'test-secret', defaultStoreSlug: 'loja',
} }))
vi.mock('@/lib/data/stores', () => ({
  getDefaultStore: async () => ({ id: 'store-1', slug: 'loja' }),
  getStoreBySlug: async () => ({ id: 'store-1', slug: 'loja' }),
}))
vi.mock('@/lib/data/customers', () => ({ findCustomerByEmail: async (email: string) =>
  email === 'student@example.com' ? { id: 'student', email, blockedAt: null } : null,
}))
vi.mock('@/lib/data/products', () => ({ getProductById: async () => ({ id: '11111111-1111-4111-8111-111111111111', storeId: 'store-1' }) }))
vi.mock('@/lib/data/products-admin', () => ({ uploadImage: vi.fn(), saveProduct: async (input: { title: string }) => {
  state.saved.push(input.title)
  return '11111111-1111-4111-8111-111111111111'
} }))

const start = new Date('2026-09-24T12:00:00Z')
function session(email: string) {
  const id = email.split('@')[0]
  const claims = { sub: id, email, session_id: `${id}-session`, aud: 'authenticated',
    role: 'authenticated', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.c2ln`,
    refresh_token: `${id}-refresh`, token_type: 'bearer', expires_in: 3600,
    user: { id, email, aud: 'authenticated', role: 'authenticated',
      app_metadata: {}, user_metadata: {}, created_at: start.toISOString() } }
}

beforeEach(() => {
  state.jar.clear()
  state.saved.length = 0
  state.logoutScopes.length = 0
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(start)
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname === '/auth/v1/verify') {
      const body = JSON.parse(String(init?.body))
      return Response.json(session(body.email))
    }
    if (url.pathname === '/auth/v1/token') {
      const body = JSON.parse(String(init?.body))
      return Response.json(session(body.refresh_token === 'admin-refresh' ? 'admin@example.com' : 'student@example.com'))
    }
    if (url.pathname === '/auth/v1/user') {
      const token = new Headers(init?.headers).get('authorization')!.replace('Bearer ', '')
      const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
      return Response.json(session(claims.email).user)
    }
    if (url.pathname === '/auth/v1/logout') {
      state.logoutScopes.push(url.searchParams.get('scope') ?? '')
      return new Response(null, { status: 204 })
    }
    throw new Error(`Unexpected auth request: ${url.pathname}`)
  })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

async function adminLogin() {
  const form = new FormData()
  form.set('email', 'admin@example.com')
  form.set('token', '123456')
  form.set('rememberBrowser', 'on')
  await expect(verificarCodigo({ step: 'email', email: '', error: null }, form)).rejects.toThrow('redirect:/admin')
}
async function studentLogin() {
  const client = await createClient()
  const { error } = await client.auth.verifyOtp({ email: 'student@example.com', token: '123456', type: 'email' })
  expect(error).toBeNull()
}
async function save() {
  const form = new FormData()
  form.set('id', '11111111-1111-4111-8111-111111111111')
  form.set('store_id', 'store-1')
  form.set('title', 'Produto de teste')
  await expect(salvarProduto(form)).resolves.toEqual({ status: 'saved', fieldErrors: {}, message: 'Produto salvo.' })
}
function applyResponseCookies(response: Awaited<ReturnType<typeof logout>>) {
  for (const { name, value, ...options } of response.cookies.getAll()) {
    if (options.maxAge === 0) state.jar.delete(name)
    else state.jar.set(name, { value, options })
  }
}
async function request(path: string) {
  const cookie = [...state.jar].map(([name, c]) => `${name}=${c.value}`).join('; ')
  const response = await updateSession(new NextRequest(`https://app.example${path}`, { headers: { cookie } }))
  applyResponseCookies(response)
  return response
}

describe('real auth cookies across admin and member flows', () => {
  it('uses the admin session for explicit store previews only', async () => {
    await adminLogin()
    expect((await request('/loja?previa=1')).headers.get('location')).toBeNull()
    expect((await request('/loja')).headers.get('location')).toBe('https://app.example/loja/entrar')
  })

  it('does not let a student session open an administrative preview', async () => {
    await studentLogin()
    expect((await request('/loja?previa=1')).headers.get('location')).toBe('https://app.example/admin/entrar')
  })

  it('saves repeatedly without losing admin authentication', async () => {
    await adminLogin()
    await save()
    await save()
    expect(state.saved).toHaveLength(2)
    await expect(requireAdmin()).resolves.toEqual({ email: 'admin@example.com' })
  })

  it('keeps the admin session when a student logs in in another tab and then saves', async () => {
    await adminLogin()
    await studentLogin()
    await save()
    await expect(requireStoreSession('loja')).resolves.toMatchObject({ customer: { email: 'student@example.com' } })
  })

  it('keeps the student session when the admin logs in in another tab', async () => {
    await studentLogin()
    await adminLogin()
    await expect(requireStoreSession('loja')).resolves.toMatchObject({ customer: { email: 'student@example.com' } })
    await save()
  })

  it('opening the store without a student session does not revoke admin access', async () => {
    await adminLogin()
    await expect(requireStoreSession('loja')).rejects.toThrow('redirect:/loja/entrar')
    expect(state.logoutScopes).toEqual([])
    await save()
  })

  it('an old shared admin cookie cannot trigger global logout when opening the store', async () => {
    const legacy = await createClient()
    await legacy.auth.verifyOtp({ email: 'admin@example.com', token: '123456', type: 'email' })
    await adminLogin()
    await expect(requireStoreSession('loja')).rejects.toThrow('redirect:/loja/entrar')
    expect(state.logoutScopes).toEqual([])
    await save()
  })

  it('does not admit a student-only session to the admin proxy', async () => {
    await studentLogin()
    expect((await request('/admin/produtos')).headers.get('location')).toBe('https://app.example/admin/entrar')
  })

  it('renews the admin token through the proxy on day six without resetting seven-day trust', async () => {
    await adminLogin()
    const trust = state.jar.get('admin-browser-session')
    await studentLogin()
    vi.setSystemTime(new Date('2026-09-30T12:00:00Z'))
    const response = await request('/admin/produtos')
    expect(response.headers.get('location')).toBeNull()
    await save()
    expect(state.jar.get('admin-browser-session')).toEqual(trust)
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
  })

  it('student logout preserves the remembered admin login', async () => {
    await adminLogin()
    await studentLogin()
    applyResponseCookies(await logout(new Request('https://app.example/sair?loja=loja', { method: 'POST' })))
    await expect(requireAdmin()).resolves.toEqual({ email: 'admin@example.com' })
    await expect(requireStoreSession('loja')).rejects.toThrow('redirect:/loja/entrar')
    expect(state.logoutScopes).toEqual(['local'])
  })

  it('admin logout preserves the student login and revokes only this admin session', async () => {
    await studentLogin()
    await adminLogin()
    applyResponseCookies(await logout(new Request('https://app.example/sair?para=admin', { method: 'POST' })))
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
    await expect(requireStoreSession('loja')).resolves.toMatchObject({ customer: { email: 'student@example.com' } })
    expect(state.logoutScopes).toEqual(['local'])
  })

  it('does not admit an admin-only session to member routes through the proxy', async () => {
    await adminLogin()
    expect((await request('/loja')).headers.get('location')).toBe('https://app.example/loja/entrar')
    await save()
  })
})
