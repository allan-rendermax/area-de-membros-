import { describe, expect, it, vi } from 'vitest'
import { createPurchaseTools } from '@/lib/agent/purchase'
import type { ActionResult, CustomerLookup, SupportAction } from '@/lib/telegram/types'

const now = new Date('2026-11-24T16:00:00Z')
const input = { email: 'DIGITADO@example.test', conversationId: 'conversation' }

function setup() {
  const lookup: CustomerLookup = {
    customer: { id: 'customer', email: 'cadastro@example.test', name: 'Cliente', blocked: false },
    storeId: 'store', storeName: 'Loja',
    products: [{ id: 'atlas', title: 'Atlas', level: 'complete' }, { id: 'bonus', title: 'Bônus', level: 'basic' }],
    orders: [{ transaction: 'private-order', status: 'pago' }], delivery: 'Entregue',
    suggestions: [{ id: 'other', email: 'sugestao@example.test', name: 'Outra pessoa' }],
  }
  const deps = {
    ops: {
      lookup: vi.fn(async () => lookup),
      execute: vi.fn<(action: Pick<SupportAction, 'kind' | 'customerId' | 'storeId' | 'expectedEmail' | 'newEmail'>) => Promise<ActionResult>>()
        .mockResolvedValue({ state: 'done', text: 'Envio aceito', logId: 'log' }),
    },
    repo: { agentResendsToday: vi.fn(async () => 0), agentResendSince: vi.fn(async () => false) },
    actions: { create: vi.fn(async () => 'action'), finish: vi.fn(async () => {}) },
    emailsUsedToday: vi.fn(async () => 0), dailyEmailLimit: 100, storeId: 'store',
    config: { dailyResendLimit: 20, quotaReserve: 30 } as const,
    now: () => new Date(now),
  }
  return { deps, lookup, tools: createPurchaseTools(deps) }
}

describe('findPurchase', () => {
  it('lastNotice não traz e-mail', async () => {
    const { lookup, tools } = setup()
    lookup.delivery = `Destinatário: Cliente+acesso@Example.Test\nCópia: suporte@sub.example.test\n${' '.repeat(230)}Reenvio: ultimo+tag@outro.example.test\n${'Aviso '.repeat(60)}`
    const result = await tools.findPurchase(input.email)
    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.lastNotice).toContain('Destinatário: [e-mail]\nCópia: [e-mail]')
      expect(result.lastNotice).toContain('Reenvio: [e-mail]')
      expect(result.lastNotice).not.toContain('@')
      expect(result.lastNotice).toHaveLength(300)
    }
  })

  it('não devolve sugestões nem pedidos', async () => {
    const { deps, tools } = setup()
    expect(await tools.findPurchase(input.email)).toEqual({
      found: true, customerId: 'customer', products: ['Atlas', 'Bônus'], lastNotice: 'Entregue',
    })
    expect(deps.ops.lookup).toHaveBeenCalledWith(input.email)
    expect(deps.actions.create).not.toHaveBeenCalled()
  })

  it('retorna só found:false quando não existe cadastro, mesmo havendo sugestões', async () => {
    const { lookup, tools } = setup()
    lookup.customer = null
    expect(await tools.findPurchase(input.email)).toEqual({ found: false })
  })
})

describe('resendAccess', () => {
  it('recusa cadastro não encontrado antes de consultar limites', async () => {
    const { deps, lookup, tools } = setup()
    lookup.customer = null
    expect(await tools.resendAccess(input)).toEqual({ ok: false, reason: 'nao_encontrado' })
    expect(deps.repo.agentResendSince).not.toHaveBeenCalled()
    expect(deps.actions.create).not.toHaveBeenCalled()
    expect(deps.ops.execute).not.toHaveBeenCalled()
  })

  it('recusa com limite_conversa no segundo reenvio em 24h', async () => {
    const { deps, tools } = setup()
    deps.repo.agentResendSince.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    expect(await tools.resendAccess(input)).toEqual({ ok: true })
    expect(await tools.resendAccess(input)).toEqual({ ok: false, reason: 'limite_conversa' })
    expect(deps.repo.agentResendSince).toHaveBeenLastCalledWith('conversation', new Date('2026-11-23T16:00:00Z'))
    expect(deps.actions.create).toHaveBeenCalledTimes(1)
    expect(deps.ops.execute).toHaveBeenCalledTimes(1)
  })

  it('verifica limite da conversa antes do limite diário e da cota', async () => {
    const { deps, tools } = setup()
    deps.repo.agentResendSince.mockResolvedValue(true)
    expect(await tools.resendAccess(input)).toEqual({ ok: false, reason: 'limite_conversa' })
    expect(deps.repo.agentResendsToday).not.toHaveBeenCalled()
    expect(deps.emailsUsedToday).not.toHaveBeenCalled()
    expect(deps.actions.create).not.toHaveBeenCalled()
    expect(deps.ops.execute).not.toHaveBeenCalled()
  })

  it('recusa com limite_dia no 21º', async () => {
    const { deps, tools } = setup()
    deps.repo.agentResendsToday.mockResolvedValue(20)
    expect(await tools.resendAccess(input)).toEqual({ ok: false, reason: 'limite_dia' })
    expect(deps.repo.agentResendsToday).toHaveBeenCalledWith('store')
    expect(deps.emailsUsedToday).not.toHaveBeenCalled()
    expect(deps.actions.create).not.toHaveBeenCalled()
    expect(deps.ops.execute).not.toHaveBeenCalled()
  })

  it('permite o 20º reenvio do dia', async () => {
    const { deps, tools } = setup()
    deps.repo.agentResendsToday.mockResolvedValue(19)
    expect(await tools.resendAccess(input)).toEqual({ ok: true })
  })

  it('recusa com cota quando restam 29', async () => {
    const { deps, tools } = setup()
    deps.emailsUsedToday.mockResolvedValue(71)
    expect(await tools.resendAccess(input)).toEqual({ ok: false, reason: 'cota' })
    expect(deps.actions.create).not.toHaveBeenCalled()
    expect(deps.ops.execute).not.toHaveBeenCalled()
  })

  it('permite reenvio quando restam exatamente 30', async () => {
    const { deps, tools } = setup()
    deps.emailsUsedToday.mockResolvedValue(70)
    expect(await tools.resendAccess(input)).toEqual({ ok: true })
  })

  it('envia só ao e-mail do cadastro', async () => {
    const { deps, tools } = setup()
    deps.ops.execute.mockImplementation(async action => {
      expect(deps.actions.create).toHaveBeenCalledWith({
        customerId: 'customer', storeId: 'store', expectedEmail: 'cadastro@example.test', conversationId: 'conversation',
      })
      expect(action).toEqual({ kind: 'resend', customerId: 'customer', storeId: 'store', expectedEmail: 'cadastro@example.test', newEmail: null })
      return { state: 'done', text: 'Envio aceito', logId: 'log' }
    })
    expect(await tools.resendAccess(input)).toEqual({ ok: true })
    expect(deps.ops.lookup).toHaveBeenCalledWith(input.email)
    expect(deps.ops.execute).toHaveBeenCalledTimes(1)
    expect(deps.actions.finish).toHaveBeenCalledWith('action', 'done', 'log', 'Envio aceito')
  })

  it('ação incerta anterior vira incerto', async () => {
    const { deps, tools } = setup()
    deps.actions.create.mockResolvedValue('locked')
    expect(await tools.resendAccess(input)).toEqual({ ok: false, reason: 'incerto' })
    expect(deps.ops.execute).not.toHaveBeenCalled()
    expect(deps.actions.finish).not.toHaveBeenCalled()
  })

  it('registra recusa das travas como done sem log', async () => {
    const { deps, tools } = setup()
    deps.ops.execute.mockResolvedValue({ state: 'done', text: 'Cadastro bloqueado' })
    expect(await tools.resendAccess(input)).toEqual({ ok: false, reason: 'recusado' })
    expect(deps.actions.finish).toHaveBeenCalledWith('action', 'done', null, 'Cadastro bloqueado')
  })

  it.each([undefined, 'log'])('preserva ação incerta e seu log %s', async logId => {
    const { deps, tools } = setup()
    deps.ops.execute.mockResolvedValue({ state: 'uncertain', text: 'Envio sem confirmação', logId })
    expect(await tools.resendAccess(input)).toEqual({ ok: false, reason: 'incerto' })
    expect(deps.actions.finish).toHaveBeenCalledWith('action', 'uncertain', logId ?? null, 'Envio sem confirmação')
  })

  it('exceção no envio mantém trava e não persiste detalhes do erro', async () => {
    const { deps, tools } = setup()
    deps.ops.execute.mockRejectedValue(new Error('cadastro@example.test: detalhe privado'))
    expect(await tools.resendAccess(input)).toEqual({ ok: false, reason: 'incerto' })
    expect(deps.actions.finish).toHaveBeenCalledWith('action', 'uncertain', null, expect.any(String))
    expect(JSON.stringify(deps.actions.finish.mock.calls)).not.toContain('detalhe privado')
    expect(JSON.stringify(deps.actions.finish.mock.calls)).not.toContain('cadastro@example.test')
  })

  it('falha ao persistir resultado não confirma sucesso nem repete o envio', async () => {
    const { deps, tools } = setup()
    deps.actions.finish.mockRejectedValue(new Error('storage unavailable'))
    expect(await tools.resendAccess(input)).toEqual({ ok: false, reason: 'incerto' })
    expect(deps.ops.execute).toHaveBeenCalledTimes(1)
    expect(deps.actions.finish).toHaveBeenLastCalledWith('action', 'uncertain', 'log', expect.any(String))
  })

  it.each(['lookup', 'conversation', 'day', 'quota', 'create'] as const)('falha em %s não inicia envio', async stage => {
    const { deps, tools } = setup()
    const fail = new Error('private database error')
    if (stage === 'lookup') deps.ops.lookup.mockRejectedValue(fail)
    if (stage === 'conversation') deps.repo.agentResendSince.mockRejectedValue(fail)
    if (stage === 'day') deps.repo.agentResendsToday.mockRejectedValue(fail)
    if (stage === 'quota') deps.emailsUsedToday.mockRejectedValue(fail)
    if (stage === 'create') deps.actions.create.mockRejectedValue(fail)
    expect(await tools.resendAccess(input)).toEqual({ ok: false, reason: 'incerto' })
    expect(deps.ops.execute).not.toHaveBeenCalled()
    expect(deps.actions.finish).not.toHaveBeenCalled()
  })
})
