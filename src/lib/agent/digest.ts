import type { Button } from '@/lib/telegram/types'
import { html } from '@/lib/telegram/format'

export type WeeklyDigest = {
  conversas: number
  resolvidas: number
  reenvios: number
  escalacoes: Record<string, number>
  novas: { id: string; rule: string }[]
  repetidas: string[]
}

export function buildDigest(m: WeeklyDigest): { text: string; buttons: Button[][] } {
  const reasons = Object.entries(m.escalacoes).map(([reason, count]) => `${reason}: ${count}`).join('\n')
  const lines = [
    '<b>📊 Resumo semanal do agente</b>',
    `Conversas: <b>${m.conversas}</b>`,
    `Resolvidas: <b>${m.resolvidas}</b>`,
    `Reenvios: <b>${m.reenvios}</b>`,
    '', '<b>Escalações por motivo:</b>', html(reasons || 'Nenhuma escalação.', 1000),
    '', '<b>Motivos repetidos:</b>', html(m.repetidas.join('\n') || 'Nenhum motivo com 3 ou mais escalações.', 500),
    '', '<b>Aprendi esta semana:</b>',
  ]
  const rules = m.novas.slice(0, 10)
  if (!rules.length) return { text: [...lines, 'Nenhuma regra nova.'].join('\n'), buttons: [] }

  // Reserve room for every numbered rule before escaping; never cut generated HTML.
  const budget = Math.floor((3499 - lines.join('\n').length - rules.length * 6) / rules.length)
  const buttons: Button[][] = rules.map((rule, index) => {
    lines.push(`${index + 1}. ${html(rule.rule, budget)}`)
    return [{ text: `Desativar ${index + 1}`, callback_data: `agk:off:${rule.id}` }]
  })
  return { text: lines.join('\n'), buttons }
}
