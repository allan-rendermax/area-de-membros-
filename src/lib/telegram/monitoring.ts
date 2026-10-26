import type { Button } from './types'

export type FailureList = { total: number; rows: { customerId: string; email: string; failedEmail: string; event: string; date: string }[]; updatedAt: string | null; unknown: number }
export type DailyMetrics = { sales: number; accessCustomers: number; accessEmails: number; delivered: number; failed: number; pending: number; complaints: number; unknown: number; resends: number; corrections: number; refused: number; uncertain: number }
export const menu: Button[][] = [[{ text: 'Clientes com falha de e-mail', callback_data: 'failures:0' }]]
const timestamp = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
export function syncLabel(value: FailureList) {
  return value.updatedAt ? `Última conferência completa: ${timestamp(value.updatedAt)}` : 'Conferência completa ainda não concluída.'
}
export function failureMessage(value: FailureList, offset: number): { text: string; buttons: Button[][] } {
  const lines = value.rows.map((r, i) => `${offset + i + 1}. ${r.email}\n${r.event === 'bounced' ? 'Devolvido' : r.event === 'suppressed' ? 'Bloqueado pelo provedor' : 'Falha de envio'} — ${timestamp(r.date)}${r.failedEmail !== r.email ? `\nDestinatário da falha: ${r.failedEmail}` : ''}`)
  const buttons: Button[][] = value.rows.map(r => [{ text: `Abrir ${r.email}`.slice(0, 64), callback_data: `view:${r.customerId}` }])
  const navigation: Button[] = []
  if (offset > 0) navigation.push({ text: 'Página anterior', callback_data: `failures:${Math.max(0, offset - 10)}` })
  if (offset + 10 < value.total) navigation.push({ text: 'Próxima página', callback_data: `failures:${offset + 10}` })
  if (navigation.length) buttons.push(navigation)
  buttons.push([{ text: 'Atualizar lista', callback_data: 'failures:0' }])
  return { text: [`Falhas pendentes de acesso — últimos 30 dias\n${value.total} clientes com falha sem entrega posterior confirmada.`, syncLabel(value), value.unknown ? `${value.unknown} avisos sem status confirmado; podem incluir outros tipos de mensagem.` : '', ...lines, 'Abra um cliente para conferir o estado atual e os botões de suporte.'].filter(Boolean).join('\n\n'), buttons }
}
export function reportWindow(now: Date): { date: string; start: string; end: string } | null {
  // The operation is configured for Brasília (UTC-03), explicitly requested by its owner.
  const local = new Date(now.getTime() - 3 * 3600_000)
  if (local.getUTCHours() !== 23) return null
  const date = local.toISOString().slice(0, 10)
  const start = new Date(`${date}T03:00:00Z`)
  return { date, start: start.toISOString(), end: new Date(start.getTime() + 23 * 3600_000).toISOString() }
}
export function dailyReport(store: string, date: string, m: DailyMetrics, failures: FailureList): string {
  return `Resumo diário — ${store}\n${date.split('-').reverse().join('/')} · 00h às 23h (Brasília)\n\nVendas pagas: ${m.sales} transações Payt (sem testes).\nClientes dessas vendas com produto publicado liberado: ${m.accessCustomers}\n\nAvisos de acesso: ${m.accessEmails}\nEntregas confirmadas: ${m.delivered}\nFalhas de envio/entrega: ${m.failed}\nAguardando entrega/status: ${m.pending}\nReclamações de spam: ${m.complaints}\nAvisos ainda sem classificação: ${m.unknown}\n\nSuporte pelo bot:\nReenvios aceitos pelo provedor: ${m.resends} (inclui correções com reenvio)\nCorreções confirmadas: ${m.corrections}\nAções encerradas sem envio confirmado: ${m.refused}\nAções em andamento ou com resultado incerto: ${m.uncertain}\n\nPendências de e-mail (30 dias): ${failures.total}\n${syncLabel(failures)}\n\nVendas usam data de pagamento (ou registro, se ausente) e estado atual. Acesso não significa login; entrega não confirma leitura. Ações realizadas fora do bot não entram no total de suporte.`
}
