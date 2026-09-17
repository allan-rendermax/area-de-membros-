import { describe, expect, it } from 'vitest'
import { buildTimeline } from '@/lib/success/timeline'

const empty = { orders: [], emails: [], devices: [], itemOpens: [] }

describe('buildTimeline', () => {
  it('junta pedidos, e-mails, acessos e itens do mais recente para o mais antigo', () => {
    const events = buildTimeline({
      orders: [{ createdAt: '2026-09-10T10:00:00Z', productName: 'Atlas', productCode: 'ATLAS', status: 'pago' }],
      emails: [{ createdAt: '2026-09-10T10:00:05Z', kind: 'acesso_novo', status: 'falhou', error: 'domínio' }],
      devices: [
        { firstSeenAt: '2026-09-11T08:00:00Z', lastSeenAt: '2026-09-12T08:00:00Z' },
        { firstSeenAt: '2026-09-11T09:00:00Z', lastSeenAt: '2026-09-11T09:00:00Z' },
      ],
      itemOpens: [{ createdAt: '2026-09-11T08:05:00Z', itemTitle: 'Capítulo 1', productTitle: 'Atlas' }],
    })
    expect(events.map((e) => [e.kind, e.title])).toEqual([
      ['acesso', 'Último acesso'],
      ['item', 'Abriu "Capítulo 1"'],
      ['acesso', 'Primeiro acesso'],
      ['email', 'E-mail: acesso chegou'],
      ['pedido', 'Pedido pago: Atlas'],
    ])
    expect(events[3].detail).toBe('falhou — domínio')
    expect(events[1].detail).toBe('Atlas')
  })

  it('sem acessos não cria eventos de acesso', () => {
    expect(buildTimeline(empty)).toEqual([])
  })

  it('primeiro e último acesso iguais viram um evento só', () => {
    const events = buildTimeline({ ...empty, devices: [{ firstSeenAt: '2026-09-11T08:00:00Z', lastSeenAt: '2026-09-11T08:00:00Z' }] })
    expect(events.map((e) => e.title)).toEqual(['Primeiro acesso'])
  })
})
