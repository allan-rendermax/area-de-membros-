import type { Button } from './types'

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Limit raw values by their escaped size, before adding any HTML tags.
export function html(value: string, budget = 400): string {
  let raw = '', size = 0
  for (const char of value) {
    const next = char === '&' ? 5 : char === '<' || char === '>' ? 4 : char.length
    if (size + next > budget - 1) return escapeHtml(raw) + '…'
    raw += char; size += next
  }
  return escapeHtml(raw)
}

export const menu: Button[][] = [[{ text: '⚠️ Clientes com falha', callback_data: 'failures:0' }]]
export const teamMenu: Button[][] = [...menu, [{ text: '👥 Gerenciar equipe', callback_data: 'team:list:0' }]]
export const cancelButton = (id: string): Button => ({ text: '✖️ Cancelar', callback_data: `cancel:${id}` })
export const customerBack = (id: string, updated = false): Button[][] => [[{ text: updated ? '👤 Ver cliente atualizado' : '👤 Voltar ao cliente', callback_data: `refresh:${id}` }]]
export const teamBack: Button[][] = [[{ text: '◀️ Voltar à equipe', callback_data: 'team:page:0' }]]

export function welcome(owner = false): string {
  return `👋 <b>Suporte ElevaMAX</b>\n\nEnvie até <b>5 e-mails</b> numa mensagem para ver compras, produtos liberados e o último aviso de acesso.\n\nEm cada cliente: 📨 reenviar acesso ou ✏️ corrigir e-mail. Nada é enviado sem a sua confirmação.\n\nAtalhos: /falhas · /id${owner ? ' · /equipe' : ''}`
}

export function orderLabel(status: string): string {
  const labels: Record<string, string> = { pago: '✅ Pago', reembolsado: '↩️ Reembolsado', pendente: '⏳ Pendente', cancelado: '❌ Cancelado', chargeback: '⚠️ Chargeback' }
  return labels[status] ?? `• ${html(status, 60)}`
}

export function deliveryEmoji(event: string): string {
  const emojis: Record<string, string> = { delivered: '📬', opened: '👀', clicked: '🔗', sent: '📤', bounced: '🔴', suppressed: '⛔', complained: '🚫', failed: '❌', delivery_delayed: '⏳', delayed: '⏳', queued: '🕒', scheduled: '🕒' }
  return emojis[event] ?? '❔'
}
