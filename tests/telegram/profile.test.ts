import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

// Evaluate the actual CLI with all I/O injected; never load private env files or use the network.
async function run(mode: string, photo = false) {
  const source = readFileSync('scripts/telegram-support.mjs', 'utf8').replace(/^import .*$/gm, '').replace('main().catch', 'await main().catch')
  const process = { argv: ['node', 'script', mode, ...(photo ? ['--photo', 'avatar.jpg'] : [])], env: { TELEGRAM_BOT_TOKEN: '123:fake', TELEGRAM_BOT_USERNAME: 'testbot', TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(32), TELEGRAM_ADMIN_USER_IDS: '123', TELEGRAM_PUBLIC_BASE_URL: 'https://example.test', SUPABASE_URL: 'https://db.test', SUPABASE_SECRET_KEY: 'fake' }, cwd: () => '.', exitCode: 0 }
  const readFile = vi.fn(async (path: string) => { if (path === 'avatar.jpg') return new Uint8Array([1, 2, 3]); throw Object.assign(new Error('missing'), { code: 'ENOENT' }) })
  const fetch = vi.fn(async (url: string) => Response.json({ ok: true, result: url.endsWith('/getMe') ? { username: 'testbot', id: 123 } : url.endsWith('/getWebhookInfo') ? { url: 'https://example.test/api/webhooks/telegram' } : true }))
  const log = { log: vi.fn(), error: vi.fn() }
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  await new AsyncFunction('readFile', 'parseEnv', 'nextEnv', 'process', 'fetch', 'console', source)(readFile, () => ({}), { loadEnvConfig() {} }, process, fetch, log)
  return { process, fetch, log, readFile }
}

describe('perfil do bot sem rede', () => {
  it('profile aplica comandos e descrições sem mudar foto ou webhook', async () => {
    const { process, fetch } = await run('profile')
    expect(process.exitCode).toBe(0)
    const calls = fetch.mock.calls as unknown as [string, RequestInit][]
    expect(calls.map(c => c[0].split('/').at(-1))).toEqual(['getMe', 'setMyCommands', 'setMyShortDescription', 'setMyDescription'])
    const commands = JSON.parse(calls[1][1].body as string).commands
    expect(commands).toEqual([{ command: 'start', description: '👋 Início e ajuda' }, { command: 'falhas', description: '⚠️ Clientes com falha de e-mail' }, { command: 'equipe', description: '👥 Gerenciar equipe (proprietário)' }, { command: 'id', description: '🆔 Ver meu ID do Telegram' }])
    expect(JSON.parse(calls[2][1].body as string).short_description.length).toBeLessThanOrEqual(120)
    expect(JSON.parse(calls[3][1].body as string).description.length).toBeLessThanOrEqual(512)
  })
  it('foto opcional usa multipart com anexo em campo próprio', async () => {
    const { process, fetch } = await run('profile', true)
    expect(process.exitCode).toBe(0)
    const call = (fetch.mock.calls as unknown as [string, RequestInit][]).find(c => c[0].endsWith('/setMyProfilePhoto'))!
    expect(call).toBeDefined()
    expect(call[1].headers).toBeUndefined()
    const body = call[1].body as FormData
    // The JSON parameter and the file must use different part names, or Telegram cannot resolve attach://.
    expect(body.getAll('photo')).toHaveLength(1)
    expect(JSON.parse(body.get('photo') as string)).toEqual({ type: 'static', photo: 'attach://avatar' })
    expect(body.get('avatar')).toBeInstanceOf(Blob)
  })
  it('activate também aplica perfil depois das verificações', async () => {
    const { process, fetch } = await run('activate')
    expect(process.exitCode).toBe(0)
    const methods = fetch.mock.calls.map(c => c[0].split('/').at(-1))
    expect(methods).toContain('setMyShortDescription')
    expect(methods).toContain('setMyDescription')
    expect(methods.indexOf('setMyDescription')).toBeLessThan(methods.indexOf('setWebhook'))
  })
})
