import { z } from 'zod'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'
import { failureMessage } from './monitoring'
import { cancelButton, customerBack, html, menu, orderLabel, teamMenu, welcome } from './format'
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
function emails(text: string): string[] {
  return [...new Set((text.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []).map(normalizeEmail))]
}
function expired(a: SupportAction, deps: SupportDeps) { return new Date(a.expiresAt).getTime() <= deps.now().getTime() }

async function showLookup(value: CustomerLookup, actor: Actor, deps: SupportDeps, queriedEmail = '', messageId?: number) {
  const { customer: c } = value
  if (!c) {
    await deps.io.send(actor.chatId, `⚠️ Não encontrei cadastro exato para:\n<code>${html(queriedEmail, 1500)}</code>\nConfira se o endereço é o mesmo usado na compra.` + (value.suggestions.length ? '\n\nEncontrei cadastros parecidos. Escolha para conferir; nenhuma correção ou envio foi feito:' : ''), value.suggestions.slice(0, 5).map(s => [{ text: s.email.slice(0, 64), callback_data: `view:${s.id}` }]))
    return
  }
  const orders = value.orders.slice(0, 8).map(o => `${orderLabel(o.status)} · <code>${html(o.transaction, 60)}</code>`).join('\n') || 'Nenhum pedido nesta loja.'
  const products = value.products.slice(0, 8).map(p => `📚 ${html(p.title, 100)} — ${p.level === 'complete' ? 'Completo' : 'Básico'}`).join('\n') || 'Nenhum produto liberado.'
  const text = `👤 <b>${html(c.name, 120)}</b>
✉️ <code>${html(c.email, 400)}</code>
🏪 ${html(value.storeName, 120)}

${c.blocked ? '🔴 <b>Cliente bloqueado</b>' : value.products.length ? '🟢 <b>Acesso liberado</b>' : '⚪ <b>Nenhum produto liberado</b>'}
${products}${value.products.length > 8 ? '\n… Mais produtos liberados; consulte o admin.' : ''}

🧾 <b>Compras</b>
${orders}${value.orders.length > 8 ? '\n… Mais compras; consulte o admin.' : ''}

📬 <b>Último aviso de acesso</b>
${html(value.delivery, 500)}`
  const buttons: Button[][] = [[{ text: '🔄 Atualizar', callback_data: `refresh:${c.id}` }]]
  if (!c.blocked && value.products.length) {
    buttons.unshift([{ text: '📨 Reenviar acesso', callback_data: `resend:${c.id}`, style: 'primary' }, { text: '✏️ Corrigir e-mail', callback_data: `correct:${c.id}` }])
  }
  if (messageId !== undefined) await deps.io.edit(actor.chatId, messageId, text, [...buttons, ...menu])
  else await deps.io.send(actor.chatId, text, [...buttons, ...menu])
}

async function onCallback(data: string, actor: Actor, deps: SupportDeps, messageId?: number) {
  const respond = async (text: string, buttons?: Button[][]) => {
    if (messageId !== undefined) {
      if (buttons) await deps.io.edit(actor.chatId, messageId, text, buttons)
      else await deps.io.edit(actor.chatId, messageId, text)
    } else await deps.io.send(actor.chatId, text, buttons)
  }
  const failedPage = data.match(/^(failures|failpage):(\d{1,6})$/)
  if (failedPage && deps.failures) {
    try {
      const offset = Number(failedPage[2])
      const page = failureMessage(await deps.failures(offset), offset)
      if (failedPage[1] === 'failpage') await respond(page.text, page.buttons)
      else await deps.io.send(actor.chatId, page.text, page.buttons)
    } catch { await deps.io.send(actor.chatId, '⚠️ Não foi possível consultar a lista agora. Tente novamente.', menu) }
    return
  }
  const view = data.match(new RegExp(`^(view|refresh):(${uuid})$`))
  if (view) {
    const lookup = await deps.ops.lookupId(view[2]); if (lookup) await showLookup(lookup, actor, deps, '', view[1] === 'refresh' ? messageId : undefined)
    else await deps.io.send(actor.chatId, '⚠️ Cadastro não encontrado. Consulte o e-mail novamente.')
    return
  }
  const create = data.match(new RegExp(`^(resend|correct):(${uuid})$`))
  if (create) {
    const value = await deps.ops.actionCustomer(create[2]), c = value?.customer
    if (!value || !c || c.blocked || !value.products.length) {
      await respond('⛔ Cadastro não encontrado, bloqueado ou sem produtos liberados. Consulte novamente.', customerBack(create[2])); return
    }
    const kind = create[1] as 'resend' | 'correct'
    const action = await deps.repo.createAction({ ...actor, customerId: c.id, storeId: value.storeId, expectedEmail: c.email, kind, state: kind === 'resend' ? 'confirm' : 'awaiting_email', expiresAt: new Date(deps.now().getTime() + 30 * 60_000).toISOString() })
    if (kind === 'resend') {
      await respond(`📨 <b>Reenviar acesso?</b>\nPara: <code>${html(action.expectedEmail, 1500)}</code>`, [[{ text: '✅ Confirmar envio', callback_data: `confirm:${action.id}`, style: 'success' }, cancelButton(action.id)]])
    } else {
      const promptId = await deps.io.send(actor.chatId, `✏️ <b>Corrigir e-mail</b>\nCadastro atual: <code>${html(action.expectedEmail, 1500)}</code>\nResponda a esta mensagem com o novo e-mail.`, undefined, true)
      await deps.repo.transition(action.id, actor, ['awaiting_email'], { promptId })
    }
    return
  }
  const parsed = data.match(new RegExp(`^(confirm|cancel):(${uuid})$`))
  const action = parsed ? await deps.repo.getAction(parsed[2], actor) : null
  if (!action || expired(action, deps)) { await deps.io.send(actor.chatId, '⚠️ Botão indisponível ou expirado. Consulte o e-mail novamente.'); return }
  if (parsed![1] === 'cancel') {
    const cancelled = await deps.repo.transition(action.id, actor, ['ready', 'awaiting_email', 'confirm'], { state: 'cancelled' })
    await respond(cancelled ? '✖️ Cancelado. Nada foi enviado.' : '⚠️ Esta ação já foi executada ou está em conferência.', customerBack(action.customerId)); return
  }
  const claimed = await deps.repo.claim(action.id, actor)
  if (!claimed) { await deps.io.send(actor.chatId, '⚠️ Ação já executada, em andamento ou indisponível. Consulte novamente antes de repetir.'); return }
  // Once claimed, every failure remains uncertain. Never repeat a mutation on webhook retries.
  try { await respond('⏳ Enviando…') } catch { /* cosmetic; execute the claimed action */ }
  let result
  try { result = await deps.ops.execute(claimed) }
  catch { result = { state: 'uncertain' as const, text: 'Resultado incerto. Confira o cadastro e o envio no admin antes de repetir a ação.' } }
  await deps.repo.transition(action.id, actor, ['processing'], { state: result.state, result: result.text, logId: result.logId ?? null, correctionConfirmed: result.correctionConfirmed ?? false })
  const icon = result.state === 'uncertain' ? '⚠️' : result.sent || result.logId ? '✅' : '⛔'
  await respond(`${icon} ${html(result.text, 3500)}`, customerBack(claimed.customerId, true))
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
    if (cb.data) await onCallback(cb.data, actor, deps, msg.message_id)
    return
  }
  const owner = deps.owners?.includes(actor.userId) ?? false
  const help = welcome(owner), buttons = owner ? teamMenu : menu
  const text = msg.text?.trim() ?? ''
  if (/^\/id(?:\s|$)/.test(text)) { await deps.io.send(actor.chatId, `🆔 Seu ID do Telegram: <code>${actor.userId}</code>`, buttons); return }
  if (/^\/(start|help)(?:\s|$)/.test(text)) { await deps.io.send(actor.chatId, help, buttons); return }
  if (/^\/falhas(?:\s|$)/.test(text)) { await onCallback('failures:0', actor, deps); return }
  const found = emails(text)
  if (msg.reply_to_message) {
    const action = await deps.repo.findReply(actor, msg.reply_to_message.message_id)
    if (action && !expired(action, deps)) {
      const email = normalizeEmail(text)
      if (!isValidEmail(email) || email.length > 254 || email === action.expectedEmail || found.length !== 1 || email !== found[0]) {
        await deps.io.send(actor.chatId, '⚠️ Responda à solicitação com somente um e-mail válido e diferente do atual.'); return
      }
      const changed = await deps.repo.transition(action.id, actor, ['awaiting_email'], { newEmail: email, state: 'confirm' })
      if (changed) await deps.io.send(actor.chatId, `✏️ <b>Corrigir e-mail</b>\n<code>${html(action.expectedEmail, 1500)}</code>\n⬇️\n<code>${html(email, 1500)}</code>\n\nA correção atualiza o login e as compras em todas as lojas. Depois envia o acesso da loja consultada para o novo endereço.`, [[{ text: '✅ Confirmar correção e envio', callback_data: `confirm:${action.id}`, style: 'success' }, cancelButton(action.id)]])
      return
    }
  }
  if (!found.length) { await deps.io.send(actor.chatId, help, buttons); return }
  if (found.length > 5) { await deps.io.send(actor.chatId, '⚠️ Envie no máximo cinco e-mails por mensagem.'); return }
  for (const email of found) {
    let stage = 'lookup'
    try {
      const result = await deps.ops.lookup(email)
      // Metadata only: never log buyer emails or raw provider responses.
      console.info('telegram_lookup_result', { updateId: update.update_id, found: Boolean(result.customer), suggestions: result.suggestions.length })
      stage = 'reply'
      await showLookup(result, actor, deps, email)
    } catch {
      console.error('telegram_lookup_failed', { updateId: update.update_id, stage })
      await deps.io.send(actor.chatId, `⚠️ Não consegui concluir a consulta de ${html(email, 1500)} agora. Isso não significa que o cadastro esteja ausente. Envie esse e-mail novamente para tentar outra vez.`, menu)
    }
  }
}
