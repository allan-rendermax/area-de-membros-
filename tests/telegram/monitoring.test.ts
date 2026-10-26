import { describe, expect, it } from 'vitest'
import { reportWindow, failureMessage, dailyReport } from '@/lib/telegram/monitoring'

describe('monitoramento do suporte', () => {
  it('usa o dia de Brasília e fecha às 23h, inclusive após meia-noite UTC', () => {
    expect(reportWindow(new Date('2026-10-26T02:05:00Z'))).toEqual({ date: '2026-10-25', start: '2026-10-25T03:00:00.000Z', end: '2026-10-26T02:00:00.000Z' })
    expect(reportWindow(new Date('2026-10-26T01:59:00Z'))).toBeNull()
  })
  it('pagina pendências sem confundir ausência de sincronização com ausência de falhas', () => {
    const m = failureMessage({ total: 11, rows: [{ customerId: 'c', email: 'x@test.com', failedEmail: 'old@test.com', event: 'bounced', date: '2026-10-25T12:00:00Z' }], updatedAt: null, unknown: 3 }, 0)
    expect(m.text).toContain('11 clientes'); expect(m.text).toContain('ainda não concluída'); expect(m.text).toContain('3 avisos sem status')
    expect(m.buttons.flat()).toContainEqual({ text: 'Próxima página', callback_data: 'failures:10' })
    expect(m.buttons.flat()).toContainEqual({ text: 'Abrir x@test.com', callback_data: 'view:c' })
  })
  it('relatório distingue envios, entregas, pendências e ações encerradas sem envio', () => {
    const text = dailyReport('Loja', '2026-10-25', { sales: 3, accessCustomers: 2, accessEmails: 4, delivered: 2, failed: 1, pending: 0, complaints: 0, unknown: 1, resends: 1, corrections: 1, refused: 2, uncertain: 1 }, { total: 7, rows: [], updatedAt: null, unknown: 1 })
    expect(text).toContain('Vendas pagas: 3'); expect(text).toContain('Entregas confirmadas: 2'); expect(text).toContain('sem envio confirmado: 2'); expect(text).toContain('Pendências de e-mail (30 dias): 7')
  })
})
