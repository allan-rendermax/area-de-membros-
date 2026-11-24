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

describe('trava de processamento', () => {
  const now = new Date('2026-11-24T12:00:00Z')
  const until = new Date('2026-11-24T12:04:50Z')

  it.each([{ rows: [{ id: 'conversation' }] }, { rows: [] }])('claim usa um único UPDATE condicional e retorna conforme as linhas: %j', async ({ rows }) => {
    io.fetch.mockResolvedValueOnce(new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } }))
    expect(await createAgentRepository().claimProcessing('conversation', until, now)).toBe(rows.length === 1)
    expect(io.fetch).toHaveBeenCalledTimes(1)
    const [url, request] = io.fetch.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.pathname).toBe('/rest/v1/agent_conversations')
    expect(parsed.searchParams.get('id')).toBe('eq.conversation')
    expect(parsed.searchParams.get('or')).toBe('(processing_until.is.null,processing_until.lte.2026-11-24T12:00:00.000Z)')
    expect(parsed.searchParams.get('select')).toBe('id')
    expect(request.method).toBe('PATCH')
    expect(JSON.parse(request.body)).toEqual({ processing_until: '2026-11-24T12:04:50.000Z' })
  })

  it('release limpa apenas a trava da conversa indicada', async () => {
    io.fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await createAgentRepository().releaseProcessing('conversation')
    const [url, request] = io.fetch.mock.calls[0]
    expect(new URL(url).pathname).toBe('/rest/v1/agent_conversations')
    expect(new URL(url).searchParams.get('id')).toBe('eq.conversation')
    expect(request.method).toBe('PATCH')
    expect(JSON.parse(request.body)).toEqual({ processing_until: null })
  })

  it.each(['claim', 'release'])('propaga falha de %s sem dados privados', async operation => {
    io.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'cliente@example.test' }), { status: 500 }))
    const repo = createAgentRepository()
    const result = operation === 'claim' ? repo.claimProcessing('conversation', until, now) : repo.releaseProcessing('conversation')
    await expect(result).rejects.toThrow(/^agent_processing_update_failed$/)
  })

  it('fake faz claim atômico, preserva a trava ao receber mensagens e permite liberação/expiração', async () => {
    const { repo } = memoryRepository()
    const incoming = { id: 'm-1', conversationId: 'conversation', storeId: 'store', accountId: 'account', platform: 'instagram' as const, customerName: 'Ana', text: 'Ajuda', at: now }
    await repo.recordIncoming(incoming)
    expect(await Promise.all([
      repo.claimProcessing('conversation', until, now), repo.claimProcessing('conversation', until, now),
    ])).toEqual([true, false])
    await repo.recordIncoming({ ...incoming, id: 'm-2' })
    expect(await repo.claimProcessing('conversation', until, now)).toBe(false)
    await repo.recordIncoming({ ...incoming, id: 'm-3', conversationId: 'other' })
    expect(await repo.claimProcessing('other', until, now)).toBe(true)
    await repo.releaseProcessing('conversation')
    expect(await repo.claimProcessing('conversation', until, now)).toBe(true)
    expect(await repo.claimProcessing('conversation', new Date(until.getTime() + 290000), until)).toBe(true)
    expect(await repo.claimProcessing('missing', until, now)).toBe(false)
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
