import { describe, expect, it } from 'vitest'
import type { AccessNotice } from '@/lib/domain/types'
import { groupFailedEmails, runResendBatch, type BatchGroup, type FailedEmail } from '@/lib/email/batch'

const failed = (id: string, customerId: string | null, storeId: string | null, createdAt: string): FailedEmail => ({
  id, customerId, storeId, toEmail: `${customerId}@x.com`, createdAt,
})

function setup(opts: { failed: FailedEmail[]; usedToday?: number; dailyLimit?: number; failFor?: string[]; noProductsFor?: string[] }) {
  const resolved: { logIds: string[]; by: string }[] = []
  const sentTo: string[] = []
  let count = 0
  const deps = {
    listUnresolvedFailed: async () => opts.failed,
    countUsedToday: async () => opts.usedToday ?? 0,
    dailyLimit: opts.dailyLimit ?? 100,
    buildNotice: async (group: BatchGroup): Promise<AccessNotice | null> =>
      opts.noProductsFor?.includes(group.customerId)
        ? null
        : {
            customerId: group.customerId,
            to: group.toEmail,
            customerName: '',
            store: { id: group.storeId, slug: 'loja', name: 'Loja' },
            products: [{ id: 'p1', title: 'Produto' }],
            kind: 'reenvio',
          },
    send: async (notice: AccessNotice) => {
      count++
      if (opts.failFor?.includes(notice.customerId)) return { ok: false as const, error: 'falhou', logId: `novo-${count}` }
      sentTo.push(notice.customerId)
      return { ok: true as const, logId: `novo-${count}` }
    },
    markResolved: async (logIds: string[], by: string) => {
      resolved.push({ logIds, by })
    },
  }
  return { deps, resolved, sentTo }
}

const list = [
  failed('l1', 'c1', 's1', '2026-09-16T10:00:00Z'),
  failed('l2', 'c1', 's1', '2026-09-16T11:00:00Z'),
  failed('l3', 'c2', 's1', '2026-09-16T12:00:00Z'),
  failed('l4', 'c3', 's1', '2026-09-16T13:00:00Z'),
]

describe('groupFailedEmails', () => {
  it('agrupa por cliente e loja, do mais antigo para o mais novo, e ignora registros incompletos', () => {
    const groups = groupFailedEmails([
      failed('l3', 'c2', 's1', '2026-09-16T12:00:00Z'),
      failed('l1', 'c1', 's1', '2026-09-16T10:00:00Z'),
      failed('l2', 'c1', 's1', '2026-09-16T11:00:00Z'),
      failed('l4', 'c1', 's2', '2026-09-16T13:00:00Z'),
      failed('l5', null, 's1', '2026-09-16T09:00:00Z'),
    ])
    expect(groups).toEqual([
      { customerId: 'c1', storeId: 's1', toEmail: 'c1@x.com', logIds: ['l1', 'l2'] },
      { customerId: 'c2', storeId: 's1', toEmail: 'c2@x.com', logIds: ['l3'] },
      { customerId: 'c1', storeId: 's2', toEmail: 'c1@x.com', logIds: ['l4'] },
    ])
  })
})

describe('runResendBatch', () => {
  it('envia um e-mail por cliente e marca os registros antigos como resolvidos', async () => {
    const { deps, resolved, sentTo } = setup({ failed: list })
    expect(await runResendBatch(deps)).toEqual({ sent: 3, failed: 0, skipped: 0, remaining: 0 })
    expect(sentTo).toEqual(['c1', 'c2', 'c3'])
    expect(resolved[0]).toEqual({ logIds: ['l1', 'l2'], by: 'novo-1' })
  })

  it('respeita o limite diário e informa o que ficou para depois', async () => {
    const { deps, sentTo } = setup({ failed: list, usedToday: 99, dailyLimit: 100 })
    expect(await runResendBatch(deps)).toEqual({ sent: 1, failed: 0, skipped: 0, remaining: 2 })
    expect(sentTo).toEqual(['c1'])
  })

  it('não envia nada quando o limite já foi atingido', async () => {
    const { deps } = setup({ failed: list, usedToday: 120, dailyLimit: 100 })
    expect(await runResendBatch(deps)).toEqual({ sent: 0, failed: 0, skipped: 0, remaining: 3 })
  })

  it('grupo bloqueado sem produtos não gasta o único slot do pagante seguinte', async () => {
    const { deps, sentTo } = setup({ failed: list, usedToday: 99, dailyLimit: 100, noProductsFor: ['c1'] })
    expect(await runResendBatch(deps)).toEqual({ sent: 1, failed: 0, skipped: 1, remaining: 1 })
    expect(sentTo).toEqual(['c2'])
  })

  it('falha de envio gasta o slot e deixa os grupos não visitados para depois', async () => {
    const { deps, sentTo } = setup({ failed: list, usedToday: 99, dailyLimit: 100, failFor: ['c1'] })
    expect(await runResendBatch(deps)).toEqual({ sent: 0, failed: 1, skipped: 0, remaining: 2 })
    expect(sentTo).toEqual([])
  })

  it('conta falhas e clientes sem produtos sem marcar como resolvidos', async () => {
    const { deps, resolved } = setup({ failed: list, failFor: ['c2'], noProductsFor: ['c3'] })
    expect(await runResendBatch(deps)).toEqual({ sent: 1, failed: 1, skipped: 1, remaining: 0 })
    expect(resolved).toHaveLength(1)
  })

  it('limita a 100 por execução', async () => {
    const many = Array.from({ length: 120 }, (_, i) => failed(`l${i}`, `c${i}`, 's1', new Date(Date.UTC(2026, 8, 16, 0, i)).toISOString()))
    const { deps } = setup({ failed: many, dailyLimit: 1000 })
    expect(await runResendBatch(deps)).toEqual({ sent: 100, failed: 0, skipped: 0, remaining: 20 })
  })

  it('ignora inelegíveis antes de contar no máximo 100 tentativas reais', async () => {
    const many = Array.from({ length: 125 }, (_, i) => failed(`l${i}`, `c${i}`, 's1', new Date(Date.UTC(2026, 8, 16, 0, i)).toISOString()))
    const noProductsFor = Array.from({ length: 25 }, (_, i) => `c${i}`)
    const { deps, sentTo } = setup({ failed: many, dailyLimit: 1000, noProductsFor })
    expect(await runResendBatch(deps)).toEqual({ sent: 100, failed: 0, skipped: 25, remaining: 0 })
    expect(sentTo).toHaveLength(100)
  })
})
