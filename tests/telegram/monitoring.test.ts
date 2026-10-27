import { describe, expect, it } from 'vitest'
import { reportWindow, failureMessage, dailyReport } from '@/lib/telegram/monitoring'

describe('monitoramento do suporte', () => {
  it('usa o dia de Brasília e fecha às 23h, inclusive após meia-noite UTC', () => {
    expect(reportWindow(new Date('2026-10-26T02:05:00Z'))).toEqual({ date: '2026-10-25', start: '2026-10-25T02:00:00.000Z', end: '2026-10-26T02:00:00.000Z' })
    expect(reportWindow(new Date('2026-10-26T01:59:00Z'))).toBeNull()
  })
  it('pagina pendências sem confundir ausência de sincronização com ausência de falhas', () => {
    const m = failureMessage({ total: 11, rows: [{ customerId: 'c', email: 'x@test.com', failedEmail: 'old@test.com', event: 'bounced', date: '2026-10-25T12:00:00Z' }], updatedAt: null, unknown: 3 }, 0)
    expect(m.text).toContain('11 clientes'); expect(m.text).toContain('ainda não concluída'); expect(m.text).toContain('3 avisos sem status')
    expect(m.buttons.flat()).toContainEqual({ text: 'Próxima ▶️', callback_data: 'failpage:10' })
    expect(m.buttons.flat()).toContainEqual({ text: '👤 x@test.com', callback_data: 'view:c' })
  })
  it('relatório distingue envios, entregas, pendências e ações encerradas sem envio', () => {
    const text = dailyReport('Loja', '2026-10-25', { sales: 3, accessCustomers: 2, accessEmails: 4, delivered: 2, failed: 1, pending: 0, complaints: 0, unknown: 1, resends: 1, corrections: 1, refused: 2, uncertain: 1 }, { total: 7, rows: [], updatedAt: null, unknown: 1 })
    expect(text).toContain('Vendas pagas: <b>3</b>'); expect(text).toContain('Entregas confirmadas: <b>2</b>'); expect(text).toContain('sem envio confirmado: <b>2</b>'); expect(text).toContain('Pendências (30 dias)</b>: <b>7</b>')
  })
})

it('janela de 24h cruza mês e cabeçalho mostra os dois dias', () => {
  expect(reportWindow(new Date('2026-11-02T02:59:00Z'))).toEqual({date:'2026-11-01',start:'2026-11-01T02:00:00.000Z',end:'2026-11-02T02:00:00.000Z'})
  const m = {sales:0,accessCustomers:0,accessEmails:0,delivered:0,failed:0,pending:0,complaints:0,unknown:0,resends:0,corrections:0,refused:0,uncertain:0}
  const text = dailyReport('<Loja>&','2026-11-01',m,{total:0,rows:[],updatedAt:null,unknown:0})
  expect(text).toContain('31/10 23h → 01/11 23h (Brasília)')
  expect(text).toContain('&lt;Loja&gt;&amp;')
})

it('listas longas de falhas escapam dados e preservam HTML dentro de 4096 caracteres', () => {
  const page = failureMessage({ total: 20, updatedAt: '2026-10-26T12:00:00Z', unknown: 4, rows: Array.from({length:10}, (_,i) => ({ customerId: String(i), email: '<&'.repeat(254), failedEmail: '>&'.repeat(254), event: 'suppressed', date: '2026-10-26T12:00:00Z' })) }, 10)
  expect(page.text).toContain('&lt;&amp;')
  expect(page.text).toContain('↳ enviado para <code>')
  expect(page.text.length).toBeLessThan(4096)
  expect(page.text.match(/<code>/g)?.length).toBe(page.text.match(/<\/code>/g)?.length)
  expect(page.buttons.flat()).toContainEqual({text:'🔄 Atualizar lista',callback_data:'failpage:10'})
})
