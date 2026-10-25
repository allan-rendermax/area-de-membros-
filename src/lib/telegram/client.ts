import type { Button, SupportDeps } from './types'

export function createTelegramClient(token: string): SupportDeps['io'] {
  async function call(method: string, payload: unknown) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000), cache: 'no-store' })
      const body = await r.json()
      if (!r.ok || body.ok !== true) throw new Error('telegram_response_failed')
      return body.result as { message_id?: number }
    } catch { throw new Error('telegram_request_failed') }
  }
  return {
    async send(chatId: number, text: string, buttons?: Button[][], forceReply = false) {
      const result = await call('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true }, ...(forceReply ? { reply_markup: { force_reply: true, selective: true, input_field_placeholder: 'novo@email.com' } } : buttons?.length ? { reply_markup: { inline_keyboard: buttons } } : {}) })
      if (!Number.isSafeInteger(result.message_id)) throw new Error('telegram_message_missing')
      return result.message_id!
    },
    async ack(id: string) { await call('answerCallbackQuery', { callback_query_id: id }) },
  }
}
export async function readProviderEmail(id: string, apiKey: string): Promise<{ subject: string; event: string } | null> {
  try {
    const r = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(8000), cache: 'no-store' })
    if (!r.ok) return null
    const body = await r.json()
    return typeof body.subject === 'string' && typeof body.last_event === 'string' ? { subject: body.subject, event: body.last_event } : null
  } catch { return null }
}
export function deliveryLabel(event: string): string {
  const labels: Record<string, string> = { delivered: 'Entregue ao servidor do destinatário (leitura não confirmada)', opened: 'Abertura registrada pelo provedor', clicked: 'Clique registrado pelo provedor', sent: 'Envio aceito; aguardando confirmação de entrega', bounced: 'E-mail devolvido pelo destinatário', suppressed: 'Envio bloqueado pelo provedor', complained: 'Reclamação de spam registrada', failed: 'Falha de envio', delivery_delayed: 'Entrega em atraso', delayed: 'Entrega em atraso', queued: 'Envio na fila', scheduled: 'Envio agendado' }
  return labels[event] ?? 'Status ainda não confirmado'
}
