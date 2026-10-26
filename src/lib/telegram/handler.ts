import { z } from 'zod'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'
import { failureMessage, menu } from './monitoring'
import type { Actor, Button, CustomerLookup, SupportAction, SupportDeps } from './types'

const chat = z.object({ id: z.number().int().safe(), type: z.string() })
const sender = z.object({ id: z.number().int().positive().safe() })
const message = z.object({ message_id: z.number().int(), chat, from: sender.optional(), text: z.string().max(8000).optional(), reply_to_message: z.object({ message_id: z.number().int() }).optional() })
export const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative().safe(),
  message: message.optional(),
  callback_query: z.object({ id: z.string().max(256), from: sender, data: z.string().max(64).optional(), message: message.optional() }).optional(),
})
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const help = 'Envie até cinco e-mails para conferir compras, acesso e entrega. Use os botões para reenviar ou corrigir o cadastro. A correção pede confirmação e reenvia o acesso. Para cancelar, use o botão Cancelar.'
function emails(text: string): string[] {
  return [...new Set((text.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []).map(normalizeEmail))]
}
function cancel(id: string): Button { return { text: 'Cancelar', callback_data: `cancel:${id}` } }
function expired(a: SupportAction, deps: SupportDeps) { return new Date(a.expiresAt).getTime() <= deps.now().getTime() }

async function showLookup(value: CustomerLookup, actor: Actor, deps: SupportDeps) {
  const { customer: c } = value
  if (!c) {
    await deps.io.send(actor.chatId, 'Não encontrei cadastro com esse e-mail.' + (value.suggestions.length ? '\nEncontrei endereços parecidos. Escolha o cadastro para conferir:' : ''), value.suggestions.map(s => [{ text: s.email, callback_data: `view:${s.id}` }]))
    return
  }
  const orders = value.orders.slice(0, 8).map(o => `${o.transaction}: ${o.status}`).join('\n') || 'Nenhum pedido nesta loja.'
  const products = value.products.map(p => `${p.title} — ${p.level === 'complete' ? 'Completo' : 'Básico'}`).join('\n') || 'Nenhum produto liberado.'
  const text = `${c.email}\n${c.name}\n${value.storeName}\n\nCompras:\n${orders}\n\nAcesso: ${c.blocked ? 'cliente bloqueado' : value.products.length ? 'liberado' : 'sem liberação'}\n${products}\n\nÚltimo aviso de acesso: ${value.delivery}`
  const buttons: Button[][] = [[{ text: 'Atualizar consulta', callback_data: `view:${c.id}` }]]
  if (!c.blocked && value.products.length) {
    const base = { ...actor, customerId: c.id, storeId: value.storeId, expectedEmail: c.email, state: 'ready' as const, expiresAt: new Date(deps.now().getTime() + 30 * 60_000).toISOString() }
    const resend = await deps.repo.createAction({ ...base, kind: 'resend' })
    const correct = await deps.repo.createAction({ ...base, kind: 'correct' })
    buttons.unshift([{ text: 'Reenviar acesso', callback_data: `open:${resend.id}` }, { text: 'Corrigir e-mail', callback_data: `open:${correct.id}` }])
  }
  await deps.io.send(actor.chatId, text.slice(0, 3900), [...buttons, ...menu])
}

async function onCallback(data: string, actor: Actor, deps: SupportDeps) {
  const failedPage = data.match(/^failures:(\d{1,6})$/)
  if (failedPage && deps.failures) {
    try {
      const offset = Number(failedPage[1])
      const page = failureMessage(await deps.failures(offset), offset)
      await deps.io.send(actor.chatId, page.text.slice(0, 3900), page.buttons)
    } catch { await deps.io.send(actor.chatId, 'Não foi possível consultar a lista agora. Tente novamente.', menu) }
    return
  }
  const view = data.match(new RegExp(`^view:(${uuid})$`))
  if (view) {
    const lookup = await deps.ops.lookupId(view[1]); if (lookup) await showLookup(lookup, actor, deps)
    else await deps.io.send(actor.chatId, 'Cadastro não encontrado. Consulte o e-mail novamente.')
    return
  }
  const parsed = data.match(new RegExp(`^(open|confirm|cancel):(${uuid})$`))
  const action = parsed ? await deps.repo.getAction(parsed[2], actor) : null
  if (!action || expired(action, deps)) { await deps.io.send(actor.chatId, 'Botão indisponível ou expirado. Consulte o e-mail novamente.'); return }
  const command = parsed![1]
  if (command === 'cancel') {
    const cancelled = await deps.repo.transition(action.id, actor, ['ready', 'awaiting_email', 'confirm'], { state: 'cancelled' })
    await deps.io.send(actor.chatId, cancelled ? 'Ação cancelada.' : 'Esta ação já foi executada ou está em conferência.'); return
  }
  if (command === 'open') {
    if (action.kind === 'resend') {
      const opened = await deps.repo.transition(action.id, actor, ['ready'], { state: 'confirm' })
      if (opened) await deps.io.send(actor.chatId, `Reenviar o acesso para ${action.expectedEmail}?`, [[{ text: 'Confirmar envio', callback_data: `confirm:${action.id}` }, cancel(action.id)]])
      else await deps.io.send(actor.chatId, 'Este botão já foi aberto. Use a confirmação da mensagem anterior.'); return
    }
    const opened = await deps.repo.transition(action.id, actor, ['ready'], { state: 'awaiting_email' })
    if (!opened) { await deps.io.send(actor.chatId, 'Esta correção já foi aberta. Responda à solicitação anterior.'); return }
    const promptId = await deps.io.send(actor.chatId, `Cadastro atual: ${action.expectedEmail}\nResponda a esta mensagem com o novo e-mail.`, undefined, true)
    await deps.repo.transition(action.id, actor, ['awaiting_email'], { promptId }); return
  }
  const claimed = await deps.repo.claim(action.id, actor)
  if (!claimed) { await deps.io.send(actor.chatId, 'Ação já executada, em andamento ou indisponível. Consulte novamente antes de repetir.'); return }
  // Once claimed, every failure remains uncertain. Never repeat a mutation on webhook retries.
  let result
  try { result = await deps.ops.execute(claimed) }
  catch { result = { state: 'uncertain' as const, text: 'Resultado incerto. Confira o cadastro e o envio no admin antes de repetir a ação.' } }
  await deps.repo.transition(action.id, actor, ['processing'], { state: result.state, result: result.text, logId: result.logId ?? null, correctionConfirmed: result.correctionConfirmed ?? false })
  await deps.io.send(actor.chatId, result.text, [[{ text: 'Conferir cadastro e envio', callback_data: `view:${claimed.customerId}` }]])
}

export async function handleTelegramUpdate(input: unknown, deps: SupportDeps): Promise<void> {
  const parsed = telegramUpdateSchema.safeParse(input); if (!parsed.success) return
  const update = parsed.data, cb = update.callback_query, msg = cb?.message ?? update.message
  const user = cb?.from ?? msg?.from
  if (!msg || !user || msg.chat.type !== 'private' || msg.chat.id !== user.id || !deps.allowedUsers.includes(user.id)) return
  const actor = { userId: user.id, chatId: msg.chat.id }
  if (!(await deps.repo.acceptUpdate(update.update_id))) return
  if (cb) {
    // Telegram's spinner acknowledgement is cosmetic; a timeout must not discard the action.
    try { await deps.io.ack(cb.id) } catch { /* best effort */ }
    if (cb.data) await onCallback(cb.data, actor, deps)
    return
  }
  const text = msg.text?.trim() ?? ''
  if (/^\/id(?:\s|$)/.test(text)) { await deps.io.send(actor.chatId, `Seu ID do Telegram: ${actor.userId}`, menu); return }
  if (/^\/(start|help)(?:\s|$)/.test(text)) { await deps.io.send(actor.chatId, help, menu); return }
  if (/^\/falhas(?:\s|$)/.test(text)) { await onCallback('failures:0', actor, deps); return }
  const found = emails(text)
  if (msg.reply_to_message) {
    const action = await deps.repo.findReply(actor, msg.reply_to_message.message_id)
    if (action && !expired(action, deps)) {
      const email = normalizeEmail(text)
      if (!isValidEmail(email) || email.length > 254 || email === action.expectedEmail || found.length !== 1 || email !== found[0]) {
        await deps.io.send(actor.chatId, 'Responda à solicitação com somente um e-mail válido e diferente do atual.'); return
      }
      const changed = await deps.repo.transition(action.id, actor, ['awaiting_email'], { newEmail: email, state: 'confirm' })
      if (changed) await deps.io.send(actor.chatId, `${action.expectedEmail} → ${email}\n\nA correção atualiza o login e as compras em todas as lojas. Depois envia o acesso da loja consultada para o novo endereço.`, [[{ text: 'Confirmar correção e envio', callback_data: `confirm:${action.id}` }, cancel(action.id)]])
      return
    }
  }
  if (!found.length) { await deps.io.send(actor.chatId, help); return }
  if (found.length > 5) { await deps.io.send(actor.chatId, 'Envie no máximo cinco e-mails por mensagem.'); return }
  for (const email of found) await showLookup(await deps.ops.lookup(email), actor, deps)
}
