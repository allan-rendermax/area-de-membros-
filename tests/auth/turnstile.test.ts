import { describe, expect, it } from 'vitest'
import { verifyTurnstile } from '@/lib/auth/turnstile'

function fakeFetch(response: { ok: boolean; body: unknown } | Error) {
  const calls: { url: string; body: string }[] = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body) })
    if (response instanceof Error) throw response
    return { ok: response.ok, json: async () => response.body } as Response
  }) as typeof fetch
  return { impl, calls }
}

describe('verifyTurnstile', () => {
  it('aprova quando a Cloudflare confirma', async () => {
    const { impl, calls } = fakeFetch({ ok: true, body: { success: true } })
    expect(await verifyTurnstile('token', '1.2.3.4', 'secret', impl)).toBe(true)
    expect(calls[0].url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(calls[0].body).toContain('response=token')
    expect(calls[0].body).toContain('remoteip=1.2.3.4')
  })

  it('recusa token vazio sem chamar a Cloudflare', async () => {
    const { impl, calls } = fakeFetch({ ok: true, body: { success: true } })
    expect(await verifyTurnstile('', '1.2.3.4', 'secret', impl)).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('recusa quando a Cloudflare nega, responde erro ou está fora do ar', async () => {
    expect(await verifyTurnstile('t', 'x', 's', fakeFetch({ ok: true, body: { success: false } }).impl)).toBe(false)
    expect(await verifyTurnstile('t', 'x', 's', fakeFetch({ ok: false, body: {} }).impl)).toBe(false)
    expect(await verifyTurnstile('t', 'x', 's', fakeFetch(new Error('rede')).impl)).toBe(false)
  })
})
