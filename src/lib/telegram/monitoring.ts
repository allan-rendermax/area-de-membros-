import type { Button } from './types'
import { html } from './format'
export { menu } from './format'

export type FailureList = { total: number; rows: { customerId: string; email: string; failedEmail: string; event: string; date: string }[]; updatedAt: string | null; unknown: number }
export type DailyMetrics = { sales: number; accessCustomers: number; accessEmails: number; delivered: number; failed: number; pending: number; complaints: number; unknown: number; resends: number; corrections: number; refused: number; uncertain: number }
const timestamp = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
export function syncLabel(value: FailureList) {
  return value.updatedAt ? `🕐 Última conferência: ${timestamp(value.updatedAt)}` : '🕐 Última conferência: conferência completa ainda não concluída.'
}
export function failureMessage(value: FailureList, offset: number): { text: string; buttons: Button[][] } {
  const rows = value.rows.slice(0, 10)
  const lines = rows.map((r, i) => `${offset + i + 1}. <code>${html(r.email, 100)}</code>\n   ${r.event === 'bounced' ? '🔴 Devolvido' : r.event === 'suppressed' ? '⛔ Bloqueado pelo provedor' : '❌ Falha de envio'} · ${timestamp(r.date)}${r.failedEmail !== r.email ? `\n↳ enviado para <code>${html(r.failedEmail, 100)}</code>` : ''}`)
  const buttons: Button[][] = rows.map(r => [{ text: `👤 ${r.email}`.slice(0, 64), callback_data: `view:${r.customerId}` }])
  const navigation: Button[] = []
  if (offset > 0) navigation.push({ text: '◀️ Anterior', callback_data: `failpage:${Math.max(0, offset - 10)}` })
  if (offset + 10 < value.total) navigation.push({ text: 'Próxima ▶️', callback_data: `failpage:${offset + 10}` })
  if (navigation.length) buttons.push(navigation)
  buttons.push([{ text: '🔄 Atualizar lista', callback_data: `failpage:${offset}` }])
  return { text: [`⚠️ <b>Falhas de e-mail — últimos 30 dias</b>\n${value.total} clientes com falha sem entrega posterior confirmada.`, syncLabel(value), value.unknown ? `${value.unknown} avisos sem status confirmado; podem incluir outros tipos de mensagem.` : '', ...lines, 'Abra um cliente para conferir o estado atual e os botões de suporte.'].filter(Boolean).join('\n\n'), buttons }
}
export function reportWindow(now: Date): { date: string; start: string; end: string } | null {
  // The operation is configured for Brasília (UTC-03), explicitly requested by its owner.
  const local = new Date(now.getTime() - 3 * 3600_000)
  if (local.getUTCHours() !== 23) return null
  const date = local.toISOString().slice(0, 10)
  const start = new Date(`${date}T02:00:00Z`)
  return { date, start: start.toISOString(), end: new Date(start.getTime() + 24 * 3600_000).toISOString() }
}
export function dailyReport(store: string, date: string, m: DailyMetrics, failures: FailureList): string {
  const previous = new Date(new Date(`${date}T12:00:00Z`).getTime() - 86400_000).toISOString().slice(0, 10)
  const day = (s: string) => s.slice(5).split('-').reverse().join('/')
  return `📊 <b>Resumo diário — ${html(store, 400)}</b>
🗓️ ${day(previous)} 23h → ${day(date)} 23h (Brasília)

💰 <b>Vendas</b>
Vendas pagas: <b>${m.sales}</b> transações Payt (sem testes).
Clientes dessas vendas com produto publicado liberado: <b>${m.accessCustomers}</b>

📧 <b>Avisos de acesso</b>: <b>${m.accessEmails}</b>
📬 Entregas confirmadas: <b>${m.delivered}</b>
❌ Falhas de envio/entrega: <b>${m.failed}</b>
⏳ Aguardando entrega/status: <b>${m.pending}</b>
🚫 Reclamações de spam: <b>${m.complaints}</b>
❔ Avisos ainda sem classificação: <b>${m.unknown}</b>

🛠️ <b>Suporte pelo bot</b>
📨 Reenvios aceitos pelo provedor: <b>${m.resends}</b> (inclui correções com reenvio)
✏️ Correções confirmadas: <b>${m.corrections}</b>
⛔ Ações encerradas sem envio confirmado: <b>${m.refused}</b>
⚠️ Ações em andamento ou com resultado incerto: <b>${m.uncertain}</b>

⚠️ <b>Pendências (30 dias)</b>: <b>${failures.total}</b>
${syncLabel(failures)}

<i>Vendas usam data de pagamento (ou registro, se ausente) e estado atual. Acesso não significa login; entrega não confirma leitura. Ações realizadas fora do bot não entram no total de suporte.</i>`
}
