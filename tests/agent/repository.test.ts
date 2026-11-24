import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAgentRepository } from '@/lib/agent/repository'
import { memoryRepository } from './memory-repository'

const io = vi.hoisted(() => ({ fetch: vi.fn() }))
let db: ReturnType<typeof createClient>
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

beforeEach(() => {
  io.fetch.mockReset()
  db = createClient('https://supabase.example.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: io.fetch },
  })
})

describe('incrementLookupMiss', () => {
  it('usa RPC atômico vinculado à conversa e retorna o novo total', async () => {
    io.fetch.mockResolvedValueOnce(new Response('2', { headers: { 'Content-Type': 'application/json' } }))
    expect(await createAgentRepository().incrementLookupMiss('conversation')).toBe(2)
    const [url, request] = io.fetch.mock.calls[0]
    expect(new URL(url).pathname).toBe('/rest/v1/rpc/agent_increment_lookup_miss')
    expect(request.method).toBe('POST')
    expect(JSON.parse(request.body)).toEqual({ p_conversation_id: 'conversation' })
  })

  it('propaga falha de persistência sem detalhes do banco', async () => {
    io.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'XX000', message: 'cadastro@example.test' }), { status: 500, headers: { 'Content-Type': 'application/json' } }))
    await expect(createAgentRepository().incrementLookupMiss('conversation')).rejects.toThrow(/^agent_lookup_miss_update_failed$/)
  })

  it.each([null, 0, -1, 1.5, '2'])('recusa contador inválido: %s', async value => {
    io.fetch.mockResolvedValueOnce(new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }))
    await expect(createAgentRepository().incrementLookupMiss('missing')).rejects.toThrow('agent_lookup_miss_update_failed')
  })

  it('fake preserva contador nas novas mensagens e isola conversas', async () => {
    const { repo } = memoryRepository()
    const incoming = { id: 'm-1', conversationId: 'conversation', storeId: 'store', accountId: 'account', platform: 'instagram' as const, customerName: 'Ana', text: 'Ajuda', at: new Date() }
    await repo.recordIncoming(incoming)
    expect(await repo.incrementLookupMiss('conversation')).toBe(1)
    await repo.recordIncoming({ ...incoming, id: 'm-2' })
    expect(await repo.incrementLookupMiss('conversation')).toBe(2)
    await repo.recordIncoming({ ...incoming, id: 'm-3', conversationId: 'other' })
    expect(await repo.incrementLookupMiss('other')).toBe(1)
    expect(await repo.incrementLookupMiss('conversation')).toBe(3)
    await expect(repo.incrementLookupMiss('missing')).rejects.toThrow('agent_lookup_miss_update_failed')
  })
})
