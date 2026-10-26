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
    io: { edit: vi.fn(async (_chat, _id, text, buttons) => { messages.push({ text, buttons }) }), send: vi.fn(async (_chat, text, buttons) => { messages.push({ text, buttons }); return messages.length }), ack: vi.fn(async () => {}) },
    ops: { actionCustomer: vi.fn(async () => ({ customer: structuredClone(snapshot.customer), storeId, products: structuredClone(snapshot.products) })), lookup: vi.fn(async () => structuredClone(snapshot)), lookupId: vi.fn(async () => structuredClone(snapshot)), execute: vi.fn(async () => ({ state: 'done' as const, text: 'Envio aceito pelo provedor.', logId: 'log' })) },
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
  it('mostra o endereço consultado quando não há cadastro exato', async () => {
    vi.mocked(deps.ops.lookup).mockResolvedValue({ ...snapshot, customer: null, suggestions: [] })
    await handleTelegramUpdate(message('keilaste@yahoo.com.br'), deps)
    expect(messages[0].text).toContain('keilaste@yahoo.com.br')
    expect(deps.ops.execute).not.toHaveBeenCalled()
  })
  it('avisa falha da consulta e continua os demais e-mails sem declarar cadastro ausente', async () => {
    vi.mocked(deps.ops.lookup).mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce(snapshot)
    await handleTelegramUpdate(message('first@example.com second@example.com'), deps)
    expect(messages[0].text).toContain('Não consegui concluir a consulta de first@example.com')
    expect(messages[0].text).not.toContain('Não encontrei')
    expect(messages[1].text).toContain('Atlas')
    expect(deps.ops.execute).not.toHaveBeenCalled()
  })
  it('avisa quando a resposta da consulta falha, sem repetir envio de acesso', async () => {
    vi.mocked(deps.io.send).mockRejectedValueOnce(new Error('timeout'))
    await handleTelegramUpdate(message('old@example.com'), deps)
    expect(messages[0].text).toContain('Não consegui concluir')
    expect(deps.ops.execute).not.toHaveBeenCalled()
  })
  it('mostra menu de falhas e restringe a lista a operadores autorizados', async () => {
    deps.failures = vi.fn(async () => ({ total: 0, rows: [], updatedAt: null, unknown: 0 }))
    await handleTelegramUpdate(message('/start'), deps)
    expect(button('Clientes com falha')).toBe('failures:0')
    await handleTelegramUpdate(callback('failures:0', 999), deps)
    expect(deps.failures).not.toHaveBeenCalled()
    await handleTelegramUpdate(callback('failures:0'), deps)
    expect(deps.failures).toHaveBeenCalledWith(0)
    expect(messages.at(-1)?.text).toContain('0 clientes')
  })
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
    await handleTelegramUpdate(callback(button('Reenviar')), deps)
    await handleTelegramUpdate(callback(button('Confirmar envio'), 456), deps)
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
    expect(messages.at(-1)?.text).toContain('<code>old@example.com</code>\n⬇️\n<code>new@example.com</code>')
    expect(deps.ops.execute).not.toHaveBeenCalled()
    await handleTelegramUpdate(callback(button('Confirmar correção')), deps)
    expect(deps.ops.execute).toHaveBeenCalledWith(expect.objectContaining({ kind: 'correct', expectedEmail: 'old@example.com', newEmail: 'new@example.com' }))
  })
  it('token expirado não executa', async () => {
    await handleTelegramUpdate(message('old@example.com'), deps)
    await handleTelegramUpdate(callback(button('Reenviar')), deps)
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

describe('fluxo visual', () => {
  it('escapa dados e não cria ações ao consultar ou atualizar', async () => {
    snapshot.customer!.name = '<b>&'; snapshot.storeName = '<Loja>&'
    await handleTelegramUpdate(message('old@example.com'), deps)
    expect(actions.size).toBe(0)
    expect(messages[0].text).toContain('<b>&lt;b&gt;&amp;</b>')
    expect(messages[0].text).toContain('&lt;Loja&gt;&amp;')
    expect(button('Reenviar')).toBe('resend:' + customerId)
    await handleTelegramUpdate(callback(button('Atualizar')), deps)
    expect(deps.io.edit).toHaveBeenCalledWith(123, 1, expect.any(String), expect.any(Array))
    expect(actions.size).toBe(0)
  })
  it('relê o cliente no clique, cria uma ação e edita a ficha', async () => {
    await handleTelegramUpdate(message('old@example.com'), deps)
    snapshot.customer!.email = 'current@example.com'
    await handleTelegramUpdate(callback(button('Reenviar')), deps)
    expect(deps.ops.actionCustomer).toHaveBeenCalledWith(customerId)
    expect(actions.size).toBe(1)
    expect([...actions.values()][0]).toMatchObject({ state: 'confirm', expectedEmail: 'current@example.com' })
    expect(deps.io.send).toHaveBeenCalledTimes(1)
    expect(deps.io.edit).toHaveBeenCalledWith(123, 1, expect.stringContaining('current@example.com'), expect.any(Array))
  })
  it.each(['blocked', 'missing', 'noProducts'])('não cria ação quando cliente está %s no clique', async condition => {
    await handleTelegramUpdate(message('old@example.com'), deps)
    if (condition === 'blocked') snapshot.customer!.blocked = true
    if (condition === 'missing') snapshot.customer = null
    if (condition === 'noProducts') snapshot.products = []
    await handleTelegramUpdate(callback(button('Reenviar')), deps)
    expect(actions.size).toBe(0)
    expect(deps.ops.execute).not.toHaveBeenCalled()
  })
  it('botão open antigo expira sem criar ação', async () => {
    await handleTelegramUpdate(callback('open:' + customerId), deps)
    expect(messages[0].text).toContain('Botão indisponível ou expirado')
    expect(actions.size).toBe(0)
  })
  it('confirma edita progresso sem botões e resultado escapado', async () => {
    await handleTelegramUpdate(callback('resend:' + customerId), deps)
    vi.mocked(deps.ops.execute).mockResolvedValue({ state: 'done', text: 'Aceito <b>&', logId: 'log' })
    await handleTelegramUpdate(callback(button('Confirmar envio')), deps)
    expect(deps.io.edit).toHaveBeenCalledWith(123, 1, '⏳ Enviando…')
    expect(messages.at(-1)?.text).toBe('✅ Aceito &lt;b&gt;&amp;')
    expect(button('Ver cliente atualizado')).toBe('refresh:' + customerId)
  })
  it('falha cosmética do progresso não impede execução', async () => {
    await handleTelegramUpdate(callback('resend:' + customerId), deps)
    vi.mocked(deps.io.edit).mockRejectedValueOnce(new Error('timeout'))
    await handleTelegramUpdate(callback(button('Confirmar envio')), deps)
    expect(deps.ops.execute).toHaveBeenCalledTimes(1)
  })
  it('cancelar edita e mantém retorno ao cliente', async () => {
    await handleTelegramUpdate(callback('resend:' + customerId), deps)
    await handleTelegramUpdate(callback(button('Cancelar')), deps)
    expect(deps.io.edit).toHaveBeenLastCalledWith(123, 1, '✖️ Cancelado. Nada foi enviado.', expect.any(Array))
    expect(button('Voltar ao cliente')).toBe('refresh:' + customerId)
    expect(deps.ops.execute).not.toHaveBeenCalled()
  })
  it('pagina falhas editando e abre cliente em nova mensagem', async () => {
    deps.failures = vi.fn(async () => ({ total: 0, rows: [], updatedAt: null, unknown: 0 }))
    await handleTelegramUpdate(callback('failpage:10'), deps)
    expect(deps.io.edit).toHaveBeenCalledWith(123, 1, expect.any(String), expect.any(Array))
    await handleTelegramUpdate(callback('view:' + customerId), deps)
    expect(deps.io.send).toHaveBeenCalledTimes(1)
  })
  it('limita valores antes do HTML sem quebrar tags ou entidades', async () => {
    snapshot.customer!.name = '&'.repeat(1000)
    snapshot.products = Array.from({length: 30}, () => ({ id: 'p', title: '<&>'.repeat(1000), level: 'complete' }))
    snapshot.orders = Array.from({length: 20}, () => ({ transaction: '&'.repeat(1000), status: '<'.repeat(1000) }))
    snapshot.delivery = '&'.repeat(1000)
    await handleTelegramUpdate(message('old@example.com'), deps)
    expect(messages[0].text.length).toBeLessThan(4096)
    expect(messages[0].text.match(/<b>/g)?.length).toBe(messages[0].text.match(/<\/b>/g)?.length)
    expect(messages[0].text).not.toMatch(/&(?!amp;|lt;|gt;)/)
  })
})

it('correção cria ação awaiting_email, usa force_reply e mantém aviso de todas as lojas', async () => {
  await handleTelegramUpdate(callback(`correct:${customerId}`), deps)
  expect([...actions.values()]).toHaveLength(1)
  expect([...actions.values()][0]).toMatchObject({ state: 'awaiting_email', expectedEmail: 'old@example.com', promptId: 1 })
  expect(deps.io.send).toHaveBeenCalledWith(123, expect.stringContaining('<code>old@example.com</code>'), undefined, true)
  expect(deps.io.edit).not.toHaveBeenCalled()
  await handleTelegramUpdate(message('a&b@example.com', 1), deps)
  expect(messages.at(-1)?.text).toContain('<code>a&amp;b@example.com</code>')
  expect(messages.at(-1)?.text).toContain('todas as lojas')
  expect(vi.mocked(deps.io.send).mock.lastCall?.[2]?.flat()).toContainEqual(expect.objectContaining({ style: 'success' }))
})
it.each([
  [{ state: 'done' as const, text: 'Recusado <&' }, '⛔'],
  [{ state: 'done' as const, text: 'Aceito <&', sent: true }, '✅'],
  [{ state: 'uncertain' as const, text: 'Incerto <&' }, '⚠️'],
])('resultado usa prefixo %s', async (result, emoji) => {
  vi.mocked(deps.ops.execute).mockResolvedValue(result)
  await handleTelegramUpdate(callback(`resend:${customerId}`), deps)
  await handleTelegramUpdate(callback(button('Confirmar envio')), deps)
  expect(messages.at(-1)?.text).toBe(`${emoji} ${result.text.replace('<&', '&lt;&amp;')}`)
})
it('callbacks da ficha e confirmação respeitam 64 bytes e estilos', async () => {
  await handleTelegramUpdate(message('old@example.com'), deps)
  expect(vi.mocked(deps.io.send).mock.lastCall?.[2]?.flat()).toContainEqual(expect.objectContaining({ style: 'primary' }))
  await handleTelegramUpdate(callback(button('Reenviar')), deps)
  expect(vi.mocked(deps.io.edit).mock.lastCall?.[3]?.flat()).toContainEqual(expect.objectContaining({ style: 'success' }))
  expect(messages.flatMap(m => m.buttons?.flat() ?? []).every(b => Buffer.byteLength(b.callback_data) <= 64)).toBe(true)
})
