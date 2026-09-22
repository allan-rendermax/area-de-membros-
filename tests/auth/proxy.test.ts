import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateSession } from '@/lib/supabase/proxy'

vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }))
vi.mock('@/lib/env', () => ({
  env: { supabaseUrl: 'https://supabase.example', supabasePublishableKey: 'publishable-test-key' },
}))

type CookieAdapter = {
  setAll: (
    cookies: Array<{ name: string; value: string; options: { httpOnly?: boolean; path?: string } }>,
    headers: Record<string, string>,
  ) => void
}

let claims: Record<string, unknown> | null
let renewSession: boolean

beforeEach(() => {
  vi.clearAllMocks()
  claims = null
  renewSession = false

  vi.mocked(createServerClient).mockImplementation((...args) => {
    const options = args[2] as { cookies: CookieAdapter }
    return {
      auth: {
        getClaims: vi.fn(async () => {
          if (renewSession) {
            options.cookies.setAll(
              [{ name: 'sb-auth-token', value: 'renovado', options: { httpOnly: true, path: '/' } }],
              {
                'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
                Expires: '0',
                Pragma: 'no-cache',
              },
            )
          }
          return { data: { claims }, error: null }
        }),
      },
    } as never
  })
})

async function location(path: string) {
  const response = await updateSession(new NextRequest(`http://localhost${path}`))
  return response.headers.get('location')
}

describe('updateSession — fronteira entre painel e lojas', () => {
  it.each([
    '/admin-loja/entrar',
    '/administracao/entrar',
    '/admin-loja/manifest.webmanifest',
    '/administracao/manifest.webmanifest',
    '/admin/entrar',
  ])('mantém pública a rota %s', async (path) => {
    expect(await location(path)).toBeNull()
  })

  it.each([
    ['/admin-loja', 'http://localhost/admin-loja/entrar'],
    ['/administracao', 'http://localhost/administracao/entrar'],
    ['/admin', 'http://localhost/admin/entrar'],
    ['/admin/pedidos', 'http://localhost/admin/entrar'],
    ['/admin/entrar-extra', 'http://localhost/admin/entrar'],
  ])('redireciona %s para a entrada correta', async (path, expected) => {
    expect(await location(path)).toBe(expected)
  })

  it.each(['/admin', '/admin/pedidos', '/admin-loja', '/administracao']) (
    'permite sessão válida em %s',
    async (path) => {
      claims = { sub: 'admin-id' }
      expect(await location(path)).toBeNull()
    },
  )

  it('preserva cookies e headers de segurança ao renovar a sessão', async () => {
    claims = { sub: 'admin-id' }
    renewSession = true
    const request = new NextRequest('http://localhost/admin/pedidos')

    const response = await updateSession(request)

    expect(request.cookies.get('sb-auth-token')?.value).toBe('renovado')
    expect(response.cookies.get('sb-auth-token')).toMatchObject({
      name: 'sb-auth-token', value: 'renovado', httpOnly: true, path: '/',
    })
    expect(response.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0')
    expect(response.headers.get('expires')).toBe('0')
    expect(response.headers.get('pragma')).toBe('no-cache')
  })
})
