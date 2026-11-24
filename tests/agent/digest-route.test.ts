import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET, maxDuration } from '@/app/api/cron/agent-digest/route'

const h = vi.hoisted(() => ({ config: vi.fn(), telegram: vi.fn(), store: vi.fn(), owners: vi.fn(), digest: vi.fn(), send: vi.fn(), client: vi.fn() }))
vi.mock('@/lib/agent/config', () => ({ getAgentConfig: h.config }))
vi.mock('@/lib/telegram/config', () => ({ getTelegramConfig: h.telegram }))
vi.mock('@/lib/data/stores', () => ({ getStoreBySlug: h.store }))
vi.mock('@/lib/telegram/team-access', () => ({ teamOwners: h.owners }))
vi.mock('@/lib/agent/repository', () => ({ createAgentRepository: () => ({ weeklyDigest: h.digest }) }))
vi.mock('@/lib/telegram/client', () => ({ createTelegramClient: h.client }))

function request(secret = 'cron-secret') {
  return new Request('https://example.test/api/cron/agent-digest', { headers: { authorization: `Bearer ${secret}` } })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-30T02:00:00Z'))
  vi.stubEnv('CRON_SECRET', 'cron-secret')
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', '')
  h.config.mockReturnValue({ storeSlug: 'agent-store' })
  h.telegram.mockReturnValue({ storeSlug: 'telegram-store', token: 'fake-token', allowedUsers: [111, 222, 333] })
  h.owners.mockReturnValue([111, 222])
  h.store.mockResolvedValue({ id: 'resolved-store' })
  h.digest.mockResolvedValue({ conversas: 12, resolvidas: 8, reenvios: 4, escalacoes: { reembolso: 3 }, novas: [{ id: 'rule-id', rule: 'Regra <segura>' }], repetidas: ['reembolso: 3x'] })
  h.client.mockReturnValue({ send: h.send })
  h.send.mockResolvedValue(42)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

it('nega segredo ausente ou incorreto antes de consultar dependências', async () => {
  for (const req of [new Request('https://example.test'), request('wrong')]) {
    expect((await GET(req)).status).toBe(401)
  }
  expect(h.config).not.toHaveBeenCalled()
  expect(h.send).not.toHaveBeenCalled()
})

it.each(['config', 'telegram'] as const)('sem %s retorna 503 e não envia', async key => {
  h[key].mockReturnValue(null)
  expect((await GET(request())).status).toBe(503)
  expect(h.digest).not.toHaveBeenCalled()
  expect(h.send).not.toHaveBeenCalled()
})

it('sem donos retorna 503 sem enviar aos operadores', async () => {
  h.owners.mockReturnValue([])
  expect((await GET(request())).status).toBe(503)
  expect(h.send).not.toHaveBeenCalled()
  expect(h.digest).not.toHaveBeenCalled()
})

it('envia HTML e botões só aos donos com métricas dos últimos sete dias da loja do agente', async () => {
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ sent: 2 })
  expect(maxDuration).toBe(60)
  expect(h.store).toHaveBeenCalledExactlyOnceWith('agent-store')
  expect(h.digest).toHaveBeenCalledExactlyOnceWith('resolved-store', new Date('2026-11-23T02:00:00Z'))
  expect(h.client).toHaveBeenCalledExactlyOnceWith('fake-token')
  expect(h.send.mock.calls.map(call => call[0])).toEqual([111, 222])
  for (const [, text, buttons] of h.send.mock.calls) {
    expect(text).toContain('📊 Resumo semanal do agente')
    expect(text).toContain('Regra &lt;segura&gt;')
    expect(buttons).toEqual([[{ text: 'Desativar 1', callback_data: 'agk:off:rule-id' }]])
  }
})

it('loja ausente retorna 503 sem consultar métricas nem enviar', async () => {
  h.store.mockResolvedValue(null)
  expect((await GET(request())).status).toBe(503)
  expect(h.digest).not.toHaveBeenCalled()
  expect(h.send).not.toHaveBeenCalled()
})

it.each(['store', 'digest', 'send'] as const)('falha de %s retorna erro genérico sem dados privados', async key => {
  h[key].mockRejectedValueOnce(new Error('cliente@example.test segredo'))
  const response = await GET(request())
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: 'falha no resumo semanal' })
})
