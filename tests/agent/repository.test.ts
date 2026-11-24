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

  it('release limpa apenas a trava da conversa e do dono indicados', async () => {
    io.fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await createAgentRepository().releaseProcessing('conversation', until)
    const [url, request] = io.fetch.mock.calls[0]
    expect(new URL(url).pathname).toBe('/rest/v1/agent_conversations')
    expect(new URL(url).searchParams.get('id')).toBe('eq.conversation')
    expect(new URL(url).searchParams.get('processing_until')).toBe('eq.2026-11-24T12:04:50.000Z')
    expect(request.method).toBe('PATCH')
    expect(JSON.parse(request.body)).toEqual({ processing_until: null })
  })

  it.each(['claim', 'release'])('propaga falha de %s sem dados privados', async operation => {
    io.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'cliente@example.test' }), { status: 500 }))
    const repo = createAgentRepository()
    const result = operation === 'claim' ? repo.claimProcessing('conversation', until, now) : repo.releaseProcessing('conversation', until)
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
    await repo.releaseProcessing('conversation', new Date(until))
    expect(await repo.claimProcessing('conversation', until, now)).toBe(true)
    expect(await repo.claimProcessing('conversation', new Date(until.getTime() + 290000), until)).toBe(true)
    expect(await repo.claimProcessing('missing', until, now)).toBe(false)
  })

  it('release não apaga trava de outra execução', async () => {
    const { repo } = memoryRepository()
    await repo.recordIncoming({ id: 'm-1', conversationId: 'conversation', storeId: 'store', accountId: 'account', platform: 'instagram', customerName: 'Ana', text: 'Ajuda', at: now })
    const nextUntil = new Date('2026-11-24T12:09:50Z')
    expect(await repo.claimProcessing('conversation', until, now)).toBe(true)
    expect(await repo.claimProcessing('conversation', nextUntil, until)).toBe(true)
    await repo.releaseProcessing('conversation', until)
    expect(await repo.claimProcessing('conversation', nextUntil, until)).toBe(false)
    await repo.releaseProcessing('conversation', new Date(nextUntil))
    expect(await repo.claimProcessing('conversation', nextUntil, until)).toBe(true)
  })
})

describe('incrementLookupMiss', () => {
  it('resetLookupMisses zera apenas a conversa indicada', async () => {
    io.fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await createAgentRepository().resetLookupMisses('conversation')
    const [url, request] = io.fetch.mock.calls[0]
    expect(new URL(url).pathname).toBe('/rest/v1/agent_conversations')
    expect(new URL(url).searchParams.get('id')).toBe('eq.conversation')
    expect(request.method).toBe('PATCH')
    expect(JSON.parse(request.body)).toEqual({ lookup_misses: 0 })
  })

  it('resetLookupMisses não expõe falha do banco', async () => {
    io.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'privado@example.test' }), { status: 500 }))
    await expect(createAgentRepository().resetLookupMisses('conversation')).rejects.toThrow(/^agent_lookup_miss_update_failed$/)
  })

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

describe('isOwnOutgoing', () => {
  it('consulta mensagens de saída gravadas por agente ou Allan', async () => {
    io.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'outgoing' }), { headers: { 'Content-Type': 'application/json' } }))
    expect(await createAgentRepository().isOwnOutgoing('outgoing')).toBe(true)
    const url = new URL(io.fetch.mock.calls[0][0])
    expect(url.searchParams.get('id')).toBe('eq.outgoing')
    expect(url.searchParams.get('author')).toBe('in.(agente,allan)')
    expect(url.searchParams.get('direction')).toBe('eq.out')
  })

  it('busca texto com trim apenas em saídas nossas, na mesma conversa e dentro do corte', async () => {
    io.fetch.mockResolvedValueOnce(Response.json(null)).mockResolvedValueOnce(Response.json([{ text: '  Resposta \n' }]))
    expect(await createAgentRepository().isOwnOutgoing('different-id', { conversationId: 'conversation', text: 'Resposta ', since: new Date('2026-11-24T11:58:00Z') })).toBe(true)
    const url = new URL(io.fetch.mock.calls[1][0])
    expect(url.searchParams.get('conversation_id')).toBe('eq.conversation')
    expect(url.searchParams.get('direction')).toBe('eq.out')
    expect(url.searchParams.get('author')).toBe('in.(agente,allan)')
    expect(url.searchParams.get('created_at')).toBe('gte.2026-11-24T11:58:00.000Z')
  })

  it('propaga erro da busca textual com código estático', async () => {
    io.fetch.mockResolvedValueOnce(Response.json(null)).mockResolvedValueOnce(Response.json({ message: 'dado privado' }, { status: 500 }))
    await expect(createAgentRepository().isOwnOutgoing('id', { conversationId: 'conversation', text: 'Resposta', since: new Date() })).rejects.toThrow(/^agent_message_read_failed$/)
  })
})

describe('weeklyDigest', () => {
  it('consulta o resumo por loja e corte temporal via RPC', async () => {
    const metrics = { conversas: 4, resolvidas: 2, reenvios: 1, escalacoes: { reembolso: 3 }, novas: [{ id: 'id', rule: 'Regra' }], repetidas: ['reembolso: 3x'] }
    io.fetch.mockResolvedValueOnce(Response.json(metrics))
    expect(await createAgentRepository().weeklyDigest('store', new Date('2026-11-17T02:00:00Z'))).toEqual(metrics)
    const [url, request] = io.fetch.mock.calls[0]
    expect(new URL(url).pathname).toBe('/rest/v1/rpc/agent_weekly_digest')
    expect(request.method).toBe('POST')
    expect(JSON.parse(request.body)).toEqual({ p_store: 'store', p_since: '2026-11-17T02:00:00.000Z' })
  })

  it.each([null, { error: true }])('não mascara erro ou ausência de métricas: %j', async failure => {
    io.fetch.mockResolvedValueOnce(failure ? new Response(JSON.stringify({ message: 'cliente@example.test' }), { status: 500 }) : Response.json(null))
    await expect(createAgentRepository().weeklyDigest('store', new Date())).rejects.toThrow(/^agent_digest_read_failed$/)
  })
})

describe('limites persistidos', () => {
  it.each(['ok', 'excesso_conversa', 'limite_diario'] as const)('reserva execução via RPC e retorna %s', async result => {
    io.fetch.mockResolvedValueOnce(Response.json(result))
    expect(await createAgentRepository().reserveRun('store', 'conversation', new Date('2026-11-24T12:00:00Z'))).toBe(result)
    const [url, request] = io.fetch.mock.calls[0]
    expect(new URL(url).pathname).toBe('/rest/v1/rpc/agent_reserve_run')
    expect(JSON.parse(request.body)).toEqual({ p_store_id: 'store', p_conversation_id: 'conversation', p_now: '2026-11-24T12:00:00.000Z' })
  })

  it.each([null, 'invalid', { error: true }])('falha de reserva %j impede execução com erro estático', async result => {
    io.fetch.mockResolvedValueOnce(result && typeof result === 'object' ? Response.json({ message: 'dados privados' }, { status: 500 }) : Response.json(result))
    await expect(createAgentRepository().reserveRun('store', 'conversation', new Date())).rejects.toThrow(/^agent_run_storage_failed$/)
  })

  it.each([true, false])('reserva aviso com UPDATE condicional; permitido=%s', async allowed => {
    io.fetch.mockResolvedValueOnce(Response.json(allowed ? [{ id: 'conversation' }] : []))
    expect(await createAgentRepository().claimNotice('conversation', new Date('2026-11-24T12:00:00Z'))).toBe(allowed)
    const [url, request] = io.fetch.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.searchParams.get('id')).toBe('eq.conversation')
    expect(parsed.searchParams.get('or')).toBe('(last_notice_at.is.null,last_notice_at.lte.2026-11-24T11:50:00.000Z)')
    expect(request.method).toBe('PATCH')
    expect(JSON.parse(request.body)).toEqual({ last_notice_at: '2026-11-24T12:00:00.000Z' })
  })

  it('erro ao reservar aviso não expõe dados', async () => {
    io.fetch.mockResolvedValueOnce(Response.json({ message: 'privado' }, { status: 500 }))
    await expect(createAgentRepository().claimNotice('conversation', new Date())).rejects.toThrow(/^agent_notice_update_failed$/)
  })
})
