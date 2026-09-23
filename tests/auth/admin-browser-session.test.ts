import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verificarCodigo } from '@/app/admin/entrar/actions'
import AdminEntrarPage from '@/app/admin/entrar/page'
import { requireAdmin } from '@/lib/auth/require-admin'
import { POST as logout } from '@/app/sair/route'
import { env } from '@/lib/env'

const state = vi.hoisted(() => ({
  jar: new Map<string, { value: string; options: Record<string, unknown> }>(),
  auth: { verifyOtp: vi.fn(), getUser: vi.fn(), getClaims: vi.fn(), signOut: vi.fn() },
}))
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (name: string) => state.jar.get(name),
  set: (name: string, value: string, options: Record<string, unknown>) => state.jar.set(name, { value, options }),
  delete: (name: string) => state.jar.delete(name),
}) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: state.auth }) }))
vi.mock('@/lib/env', () => ({ env: {
  adminEmails: ['admin@example.com'], loginGuardSecret: 'test-signing-secret', defaultStoreSlug: 'loja',
} }))

const initial = { step: 'email' as const, email: '', error: null }
const start = new Date('2026-09-23T12:00:00Z')
const cookieName = 'admin-browser-session'

async function login(remember = true) {
  const form = new FormData()
  form.set('email', 'admin@example.com')
  form.set('token', '123456')
  if (remember) form.set('rememberBrowser', 'on')
  await expect(verificarCodigo(initial, form)).rejects.toThrow('redirect:/admin')
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(start)
  state.jar.clear()
  state.auth.verifyOtp.mockResolvedValue({ data: { user: { id: 'admin-id' }, session: { access_token: 'verified-access-token' } }, error: null })
  state.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-id', email: 'admin@example.com' } }, error: null })
  state.auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'admin-id', session_id: 'session-1' } }, error: null })
  state.auth.signOut.mockResolvedValue({ error: null })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  env.adminEmails.splice(0, env.adminEmails.length, 'admin@example.com')
})

describe('admin — lembrar navegador por sete dias', () => {
  it('persiste a escolha em cookie protegido e libera o painel', async () => {
    await login()
    expect(state.jar.get(cookieName)?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 604800 })
    await expect(requireAdmin()).resolves.toEqual({ email: 'admin@example.com' })
  })

  it('sem marcar a opção usa cookie de sessão, sem persistência', async () => {
    await login(false)
    const cookie = state.jar.get(cookieName)
    expect(cookie).toBeDefined()
    expect(cookie?.options.maxAge).toBeUndefined()
    expect(cookie?.options.expires).toBeUndefined()
    await expect(requireAdmin()).resolves.toEqual({ email: 'admin@example.com' })
  })

  it('só envia a confiança por HTTPS em produção', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await login()
    expect(state.jar.get(cookieName)?.options.secure).toBe(true)
  })

  it('mantém o prazo original mesmo acessando o painel no sexto dia', async () => {
    await login()
    vi.setSystemTime(new Date('2026-09-29T12:00:00Z'))
    await expect(requireAdmin()).resolves.toEqual({ email: 'admin@example.com' })
    vi.setSystemTime(new Date('2026-09-30T11:59:59Z'))
    await expect(requireAdmin()).resolves.toEqual({ email: 'admin@example.com' })
    vi.setSystemTime(new Date('2026-09-30T12:00:00Z'))
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
    expect(await AdminEntrarPage()).toBeTruthy()
  })

  it('mantém o prazo original após renovação do token na mesma sessão', async () => {
    await login()
    const issuedCookie = state.jar.get(cookieName)?.value
    state.auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'admin-id', session_id: 'session-1', iat: start.getTime() / 1000 + 86400 } }, error: null })
    vi.setSystemTime(new Date('2026-09-30T11:59:59.999Z'))
    await expect(requireAdmin()).resolves.toEqual({ email: 'admin@example.com' })
    expect(state.jar.get(cookieName)?.value).toBe(issuedCookie)
    vi.setSystemTime(new Date('2026-09-30T12:00:00Z'))
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
  })

  it('abre o painel diretamente ao revisitar a tela de login', async () => {
    await login()
    await expect(Promise.resolve().then(() => AdminEntrarPage())).rejects.toThrow('redirect:/admin')
  })

  it('exige código sem o cookie, mesmo com sessão Supabase válida', async () => {
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
  })

  it('recusa adulteração do cookie', async () => {
    await login()
    expect(state.jar.has(cookieName)).toBe(true)
    const cookie = state.jar.get(cookieName)!
    cookie.value += 'changed'
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
  })

  it('não reaproveita a confiança em outra sessão do mesmo usuário', async () => {
    await login()
    state.auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'admin-id', session_id: 'session-2' } }, error: null })
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
  })

  it('não permite prolongar o prazo adulterando a data do cookie', async () => {
    await login()
    const cookie = state.jar.get(cookieName)!
    cookie.value = cookie.value.replace(/^\d+/, String(start.getTime() + 86400000))
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'))
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
  })

  it('recusa uma sessão cujo usuário difere do usuário confirmado pelo provedor', async () => {
    await login()
    state.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'another-id', email: 'admin@example.com' } }, error: null })
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
  })

  it('continua exigindo usuário autenticado e autorizado', async () => {
    await login()
    state.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
    state.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'admin-id', email: 'aluno@example.com' } }, error: null })
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
  })

  it('nega acesso quando a allowlist muda ou o provedor falha', async () => {
    await login()
    env.adminEmails.splice(0)
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
    env.adminEmails.push('admin@example.com')
    state.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('provider unavailable') })
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
    state.auth.getClaims.mockResolvedValueOnce({ data: null, error: new Error('provider unavailable') })
    await expect(requireAdmin()).rejects.toThrow('redirect:/admin/entrar')
  })

  it.each([
    { sub: undefined, session_id: 'session-1' },
    { sub: 'admin-id', session_id: undefined },
    { sub: 'admin-id', session_id: '' },
  ])('não cria confiança quando claims estão incompletos: %j', async (claims) => {
    state.auth.getClaims.mockResolvedValueOnce({ data: { claims }, error: null })
    const form = new FormData()
    form.set('email', 'admin@example.com')
    form.set('token', '123456')
    form.set('rememberBrowser', 'on')
    expect((await verificarCodigo(initial, form)).error).toBe('Código inválido ou expirado.')
    expect(state.jar.has(cookieName)).toBe(false)
  })

  it('não cria confiança quando a leitura de claims falha', async () => {
    state.auth.getClaims.mockRejectedValueOnce(new Error('provider unavailable'))
    const form = new FormData()
    form.set('email', 'admin@example.com')
    form.set('token', '123456')
    form.set('rememberBrowser', 'on')
    expect((await verificarCodigo(initial, form)).error).toBe('Código inválido ou expirado.')
    expect(state.jar.has(cookieName)).toBe(false)
  })

  it('não confia no navegador quando o código é recusado', async () => {
    state.auth.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: new Error('invalid') })
    const form = new FormData()
    form.set('email', 'admin@example.com')
    form.set('token', '123456')
    form.set('rememberBrowser', 'on')
    expect((await verificarCodigo(initial, form)).error).toBe('Código inválido ou expirado.')
    expect(state.jar.size).toBe(0)
  })

  it('não cria confiança se a verificação não produzir uma sessão válida', async () => {
    state.auth.getClaims.mockResolvedValueOnce({ data: null, error: new Error('missing session') })
    const form = new FormData()
    form.set('email', 'admin@example.com')
    form.set('token', '123456')
    form.set('rememberBrowser', 'on')
    expect((await verificarCodigo(initial, form)).error).toBe('Código inválido ou expirado.')
    expect(state.jar.size).toBe(0)
  })

  it('não cria confiança sem sessão nova mesmo quando claims antigos estão disponíveis', async () => {
    state.auth.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'admin-id' }, session: null }, error: null })
    const form = new FormData()
    form.set('email', 'admin@example.com')
    form.set('token', '123456')
    form.set('rememberBrowser', 'on')
    expect((await verificarCodigo(initial, form)).error).toBe('Código inválido ou expirado.')
    expect(state.jar.has(cookieName)).toBe(false)
  })

  it('não cria confiança quando o usuário confirmado difere dos claims', async () => {
    state.auth.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'other-id' }, session: { access_token: 'verified-access-token' } }, error: null })
    const form = new FormData()
    form.set('email', 'admin@example.com')
    form.set('token', '123456')
    form.set('rememberBrowser', 'on')
    expect((await verificarCodigo(initial, form)).error).toBe('Código inválido ou expirado.')
    expect(state.jar.has(cookieName)).toBe(false)
  })

  it('remove a confiança ao sair', async () => {
    await login()
    const response = await logout(new Request('http://localhost/sair?para=admin', { method: 'POST' }))
    expect(response.headers.get('location')).toBe('http://localhost/admin/entrar')
    expect(response.cookies.get(cookieName)?.maxAge).toBe(0)
  })
})
