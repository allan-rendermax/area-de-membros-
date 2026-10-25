import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleTelegramUpdate } from '@/lib/telegram/handler'
import type { Actor, SupportAction, SupportDeps, CustomerLookup } from '@/lib/telegram/types'

const customerId = '00000000-0000-4000-8000-000000000001'
const storeId = '00000000-0000-4000-8000-000000000002'
let deps: SupportDeps
let actions: Map<string, SupportAction>
let messages: { text: string; buttons?: { text: string; callback_data: string }[][] }[]
let snapshot: CustomerLookup
let updateId = 0
function message(text: string, reply?: number, userId = 123) {
  return { update_id: ++updateId, message: { message_id: updateId, text, from: { id: userId }, chat: { id: userId, type: 'private' }, ...(reply ? { reply_to_message: { message_id: reply } } : {}) } }
}
function callback(data: string, userId = 123) {
  return { update_id: ++updateId, callback_query: { id: 'cb', data, from: { id: userId }, message: { message_id: 1, chat: { id: userId, type: 'private' } } } }
}
function button(text: string) { return messages.flatMap(m => m.buttons?.flat() ?? []).findLast(b => b.text.includes(text))!.callback_data }
beforeEach(() => {
  actions = new Map(); messages = []; updateId = 0
  snapshot = { customer: { id: customerId, email: 'old@example.com', name: 'Cliente', blocked: false }, storeId, storeName: 'Loja', orders: [{ transaction: 'TX', status: 'pago' }], products: [{ id: 'product', title: 'Atlas', level: 'complete' }], delivery: 'E-mail devolvido', suggestions: [] }
  const seen = new Set<number>()
  const owns = (a: SupportAction, who: Actor) => a.userId === who.userId && a.chatId === who.chatId
  deps = {
    allowedUsers: [123, 456], now: () => new Date('2026-10-25T12:00:00Z'),
    io: { send: vi.fn(async (_chat, text, buttons) => { messages.push({ text, buttons }); return messages.length }), ack: vi.fn(async () => {}) },
    ops: { lookup: vi.fn(async () => structuredClone(snapshot)), lookupId: vi.fn(async () => structuredClone(snapshot)), execute: vi.fn(async () => ({ state: 'done' as const, text: 'Envio aceito pelo provedor.', logId: 'log' })) },
    repo: {
      acceptUpdate: async id => { if (seen.has(id)) return false; seen.add(id); return true },
      createAction: async input => { const a = { ...input, id: `00000000-0000-4000-8000-${String(actions.size + 10).padStart(12, '0')}`, promptId: null, newEmail: null, logId: null, result: null }; actions.set(a.id, a); return a },
      getAction: async (id, who) => { const a = actions.get(id); return a && owns(a, who) ? structuredClone(a) : null },
      transition: async (id, who, from, patch) => { const a = actions.get(id); if (!a || !owns(a, who) || !from.includes(a.state)) return null; Object.assign(a, patch); return structuredClone(a) },
      findReply: async (who, prompt) => structuredClone([...actions.values()].find(a => owns(a, who) && a.state === 'awaiting_email' && a.promptId === prompt) ?? null),
      claim: async (id, who) => { const a = actions.get(id); if (!a || !owns(a, who) || a.state !== 'confirm' || [...actions.values()].some(other => other.customerId === a.customerId && ['processing', 'uncertain'].includes(other.state))) return null; a.state = 'processing'; return structuredClone(a) },
    },
  }
})

describe('suporte Telegram', () => {
  it('recusa operador desconhecido antes de consultar clientes', async () => {
    await handleTelegramUpdate(message('old@example.com', undefined, 999), deps)
    expect(deps.ops.lookup).not.toHaveBeenCalled(); expect(deps.repo.acceptUpdate).toBeDefined()
    expect(messages).toHaveLength(0)
  })
  it('recusa grupos mesmo para operador autorizado', async () => {
    const update = message('old@example.com'); update.message.chat.type = 'group'
    await handleTelegramUpdate(update, deps); expect(deps.ops.lookup).not.toHaveBeenCalled()
  })
  it('consulta endereço normalizado e mostra acesso e devolução', async () => {
    await handleTelegramUpdate(message('Confere OLD@example.com'), deps)
    expect(deps.ops.lookup).toHaveBeenCalledWith('old@example.com')
    expect(messages[0].text).toContain('Atlas — Completo'); expect(messages[0].text).toContain('devolvido')
    expect(button('Reenviar')).toBeTruthy(); expect(button('Corrigir')).toBeTruthy()
  })
  it('replay do webhook não repete consulta', async () => {
    const u = message('old@example.com'); await handleTelegramUpdate(u, deps); await handleTelegramUpdate(u, deps)
    expect(deps.ops.lookup).toHaveBeenCalledTimes(1)
  })
  it('falha do aviso de clique não perde a ação confirmada pelo operador', async () => {
    await handleTelegramUpdate(message('old@example.com'), deps)
    vi.mocked(deps.io.ack).mockRejectedValue(new Error('Telegram ACK timeout'))
    await handleTelegramUpdate(callback(button('Reenviar')), deps)
    const confirm = button('Confirmar envio')
    await handleTelegramUpdate(callback(confirm), deps)
    expect(deps.ops.execute).toHaveBeenCalledTimes(1)
  })
  it('limita lote a cinco endereços sem processar parcialmente', async () => {
    await handleTelegramUpdate(message(Array.from({ length: 6 }, (_, i) => `a${i}@example.com`).join('\n')), deps)
    expect(deps.ops.lookup).not.toHaveBeenCalled(); expect(messages[0].text).toContain('cinco')
  })
  it('reenviar exige confirmação e dois cliques concorrentes só executam uma vez', async () => {
    await handleTelegramUpdate(message('old@example.com'), deps)
    await handleTelegramUpdate(callback(button('Reenviar')), deps)
    expect(deps.ops.execute).not.toHaveBeenCalled()
    expect(messages.at(-1)?.text).toContain('old@example.com')
    const confirm = button('Confirmar envio')
    await Promise.all([handleTelegramUpdate(callback(confirm), deps), handleTelegramUpdate(callback(confirm), deps)])
    expect(deps.ops.execute).toHaveBeenCalledTimes(1)
  })
  it('outro operador não consegue confirmar token alheio', async () => {
    await handleTelegramUpdate(message('old@example.com'), deps)
    await handleTelegramUpdate(callback(button('Reenviar'), 456), deps)
    expect(deps.ops.execute).not.toHaveBeenCalled(); expect(messages.at(-1)?.text).toContain('indisponível')
  })
  it('resposta fora do prompt não corrige e-mail', async () => {
    await handleTelegramUpdate(message('old@example.com'), deps)
    await handleTelegramUpdate(callback(button('Corrigir')), deps)
    await handleTelegramUpdate(message('new@example.com', 999), deps)
    expect(deps.ops.execute).not.toHaveBeenCalled()
    expect([...actions.values()].every(a => a.newEmail === null)).toBe(true)
  })
  it('corrigir mostra anterior e novo, depois executa somente na confirmação', async () => {
    await handleTelegramUpdate(message('old@example.com'), deps)
    await handleTelegramUpdate(callback(button('Corrigir')), deps)
    const prompt = messages.length
    await handleTelegramUpdate(message(' NEW@example.com ', prompt), deps)
    expect(messages.at(-1)?.text).toContain('old@example.com → new@example.com')
    expect(deps.ops.execute).not.toHaveBeenCalled()
    await handleTelegramUpdate(callback(button('Confirmar correção')), deps)
    expect(deps.ops.execute).toHaveBeenCalledWith(expect.objectContaining({ kind: 'correct', expectedEmail: 'old@example.com', newEmail: 'new@example.com' }))
  })
  it('token expirado não executa', async () => {
    await handleTelegramUpdate(message('old@example.com'), deps)
    const a = [...actions.values()][0]; a.expiresAt = '2026-10-25T11:59:59Z'
    await handleTelegramUpdate(callback(`confirm:${a.id}`), deps)
    expect(deps.ops.execute).not.toHaveBeenCalled()
  })
  it('falha de execução fica incerta e não permite repetir o clique', async () => {
    vi.mocked(deps.ops.execute).mockRejectedValue(new Error('secret database message'))
    await handleTelegramUpdate(message('old@example.com'), deps)
    await handleTelegramUpdate(callback(button('Reenviar')), deps)
    const confirm = button('Confirmar envio'); await handleTelegramUpdate(callback(confirm), deps); await handleTelegramUpdate(callback(confirm), deps)
    expect(deps.ops.execute).toHaveBeenCalledTimes(1)
    expect([...actions.values()].some(a => a.state === 'uncertain')).toBe(true)
    expect(messages.map(m => m.text).join('\n')).not.toContain('secret database message')
  })
  it('bloqueado não recebe botões de alteração', async () => {
    snapshot.customer!.blocked = true; await handleTelegramUpdate(message('old@example.com'), deps)
    expect(messages[0].buttons?.flat().some(b => /Reenviar|Corrigir/.test(b.text))).toBeFalsy()
  })
})
