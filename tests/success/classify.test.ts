import { describe, expect, it } from 'vitest'
import { classifyCustomer, summarizeSuccess, type SuccessRow } from '@/lib/success/classify'

const now = new Date('2026-09-17T12:00:00Z')

function row(extra: Partial<SuccessRow>): SuccessRow {
  return {
    customerId: 'c1', email: 'a@b.com', firstPaidAt: '2026-09-10T12:00:00Z', paidOrders: 1,
    lastSeenAt: null, itemOpens: 0, lastItemOpenAt: null, ...extra,
  }
}

describe('classifyCustomer', () => {
  it('nunca entrou quando comprou há mais de 24h e não tem acesso', () => {
    expect(classifyCustomer(row({}), now)).toBe('nunca_entrou')
  })

  it('compra recente sem login ainda não conta como nunca entrou', () => {
    expect(classifyCustomer(row({ firstPaidAt: '2026-09-17T02:00:00Z' }), now)).toBe('inativo')
  })

  it('entrou e não abriu nada', () => {
    expect(classifyCustomer(row({ lastSeenAt: '2026-09-11T00:00:00Z' }), now)).toBe('nao_abriu')
  })

  it('ativo quando abriu item nos últimos 30 dias', () => {
    expect(
      classifyCustomer(row({ lastSeenAt: '2026-09-11T00:00:00Z', itemOpens: 3, lastItemOpenAt: '2026-09-01T00:00:00Z' }), now),
    ).toBe('ativo')
  })

  it('inativo quando a última abertura passou de 30 dias', () => {
    expect(
      classifyCustomer(
        row({ firstPaidAt: '2026-07-01T00:00:00Z', lastSeenAt: '2026-07-02T00:00:00Z', itemOpens: 2, lastItemOpenAt: '2026-07-02T00:00:00Z' }),
        now,
      ),
    ).toBe('inativo')
  })
})

describe('summarizeSuccess', () => {
  it('calcula compradores do período e percentuais', () => {
    const rows = [
      row({}),
      row({ customerId: 'c2', lastSeenAt: '2026-09-11T00:00:00Z' }),
      row({ customerId: 'c3', lastSeenAt: '2026-09-11T00:00:00Z', itemOpens: 1, lastItemOpenAt: '2026-09-12T00:00:00Z' }),
      row({ customerId: 'c4', firstPaidAt: '2026-06-01T00:00:00Z' }),
    ]
    expect(summarizeSuccess(rows, now, 30)).toEqual({ buyers: 3, loggedInPct: 67, openedPct: 33 })
  })

  it('período sem compradores dá zero', () => {
    expect(summarizeSuccess([], now, 7)).toEqual({ buyers: 0, loggedInPct: 0, openedPct: 0 })
  })
})
