import { createClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAgentActions } from '@/lib/agent/repository'

const io = vi.hoisted(() => ({ fetch: vi.fn() }))
let db: ReturnType<typeof createClient>
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

const input = { customerId: 'customer', storeId: 'store', expectedEmail: 'cadastro@example.test', conversationId: 'conversation' }

beforeEach(() => {
  io.fetch.mockReset()
  db = createClient('https://supabase.example.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: io.fetch },
  })
})
afterEach(() => { vi.useRealTimers() })

function respond(body: unknown, status = 200) {
  io.fetch.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

describe('createAgentActions', () => {
  it('cria ação processing do agente vinculada à conversa, sem identidade Telegram', async () => {
    respond({ id: 'action' }, 201)
    expect(await createAgentActions().create(input)).toBe('action')
    const [url, request] = io.fetch.mock.calls[0]
    expect(new URL(url).pathname).toBe('/rest/v1/telegram_support_actions')
    expect(new URL(url).searchParams.get('select')).toBe('id')
    expect(request.method).toBe('POST')
    expect(JSON.parse(request.body)).toEqual({
      origin: 'agente', kind: 'resend', state: 'processing', user_id: null, chat_id: null,
      customer_id: 'customer', store_id: 'store', expected_email: 'cadastro@example.test', conversation_id: 'conversation',
    })
  })

  it('traduz conflito 23505 da trava compartilhada para locked', async () => {
    respond({ code: '23505', message: 'duplicate key violates telegram_support_customer_lock' }, 409)
    expect(await createAgentActions().create(input)).toBe('locked')
  })

  it('não confunde outros erros de criação com trava', async () => {
    respond({ code: '23503', message: 'cadastro@example.test: FK detail' }, 409)
    await expect(createAgentActions().create(input)).rejects.toThrow('agent_action_storage_failed')
  })

  it.each([['done', 'log'], ['done', null], ['uncertain', null]] as const)('finaliza %s com log %s e data', async (state, logId) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-24T16:00:00Z'))
    respond({ id: 'action' })
    await createAgentActions().finish('action', state, logId, 'Resultado')
    const [url, request] = io.fetch.mock.calls[0]
    expect(new URL(url).pathname).toBe('/rest/v1/telegram_support_actions')
    expect(new URL(url).searchParams.get('id')).toBe('eq.action')
    expect(new URL(url).searchParams.get('origin')).toBe('eq.agente')
    expect(request.method).toBe('PATCH')
    expect(JSON.parse(request.body)).toEqual({ state, log_id: logId, result: 'Resultado', finished_at: '2026-11-24T16:00:00.000Z' })
  })

  it('propaga falha de finalização sem detalhes de cliente', async () => {
    respond({ code: 'XX000', message: 'cadastro@example.test: private error' }, 500)
    await expect(createAgentActions().finish('action', 'done', 'log', 'Resultado')).rejects.toThrow('agent_action_update_failed')
  })
})
