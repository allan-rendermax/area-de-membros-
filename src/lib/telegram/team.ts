import { telegramUpdateSchema } from './handler'
import { menu } from './monitoring'
import type { Button, SupportDeps } from './types'

export type TeamMember = { user_id: number; name: string; active: boolean; version: number }
export type TeamChange = { id: string; kind: 'grant' | 'revoke'; state: string; target_id: number | null; target_name: string | null }
export interface TeamRepository {
  list(offset: number): Promise<{ members: TeamMember[]; total: number }>
  member(id: number): Promise<TeamMember | null>
  start(owner: number): Promise<TeamChange>
  prompt(id: string, owner: number, messageId: number): Promise<void>
  reply(owner: number, messageId: number): Promise<TeamChange | null>
  prepare(id: string, owner: number, target: number, name: string, version: number): Promise<TeamChange | null>
  revoke(owner: number, member: TeamMember): Promise<TeamChange>
  get(id: string, owner: number): Promise<TeamChange | null>
  apply(id: string, owner: number, owners: number[]): Promise<string>
  cancel(id: string, owner: number): Promise<void>
}
export type TeamDeps = { owners: number[]; io: SupportDeps['io']; repo: TeamRepository; acceptUpdate(id: number): Promise<boolean> }
export const teamMenu: Button[][] = [...menu, [{ text: 'Gerenciar equipe', callback_data: 'team:list:0' }]]
const back: Button[][] = [[{ text: 'Voltar à equipe', callback_data: 'team:list:0' }]]
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
export function parseMember(text: string): { id: number; name: string } | null {
  const match = text.trim().match(/^(\d{1,16})[ \t]+([^\r\n]{1,80})$/)
  if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) <= 0 || /[\x00-\x1f\x7f]/.test(match[2])) return null
  const name = match[2].trim()
  return name ? { id: Number(match[1]), name } : null
}
async function confirm(a: TeamChange, owner: number, io: TeamDeps['io']) {
  const granting = a.kind === 'grant'
  await io.send(owner, `${granting ? 'Liberar acesso' : 'Remover acesso'} de ${a.target_name}?\nID Telegram: ${a.target_id}\n\n${granting ? 'Poderá consultar clientes, listar falhas, corrigir e-mail e reenviar acesso. Não poderá gerenciar a equipe e não receberá relatórios automaticamente. Confira o ID com o colega antes de confirmar.' : 'Novas consultas e ações serão bloqueadas. Confirmações de suporte pendentes serão canceladas. Uma ação que já começou pode concluir.'}`, [[{ text: granting ? 'Confirmar liberação' : 'Confirmar remoção', callback_data: `team:confirm:${a.id}` }, { text: 'Cancelar', callback_data: `team:cancel:${a.id}` }]])
}
export async function handleTeamUpdate(input: unknown, deps: TeamDeps): Promise<boolean> {
  const parsed = telegramUpdateSchema.safeParse(input)
  if (!parsed.success) return false
  const u = parsed.data, cb = u.callback_query, msg = cb?.message ?? u.message, user = cb?.from ?? msg?.from
  if (!msg || !user || msg.chat.type !== 'private' || msg.chat.id !== user.id) return false
  const text = msg.text?.trim() ?? '', data = cb?.data ?? '', owner = deps.owners.includes(user.id)
  const teamRequest = data.startsWith('team:') || /^\/equipe(?:\s|$)/.test(text)
  if (!owner) {
    if (!teamRequest) return false
    if (await deps.acceptUpdate(u.update_id)) await deps.io.send(user.id, 'Somente o proprietário pode gerenciar a equipe.')
    return true
  }
  const reply = !cb && msg.reply_to_message ? await deps.repo.reply(user.id, msg.reply_to_message.message_id) : null
  const start = !cb && /^\/(start|help)(?:\s|$)/.test(text)
  if (!teamRequest && !reply && !start) return false
  if (!(await deps.acceptUpdate(u.update_id))) return true
  if (cb) { try { await deps.io.ack(cb.id) } catch { /* cosmetic */ } }
  if (start) {
    await deps.io.send(user.id, 'Envie até cinco e-mails para conferir compras e acessos. Use os botões para consultar falhas ou gerenciar os membros da sua equipe.', teamMenu)
    return true
  }
  if (reply) {
    const target = parseMember(text)
    if (!target) { await deps.io.send(user.id, 'Responda à solicitação com ID e nome, por exemplo: 123456789 Maria Silva. Peça ao colega que abra o bot e envie /id.'); return true }
    if (deps.owners.includes(target.id)) { await deps.io.send(user.id, 'O proprietário já tem acesso e não pode ser alterado por este menu.', back); return true }
    const current = await deps.repo.member(target.id)
    const a = await deps.repo.prepare(reply.id, user.id, target.id, target.name, current?.version ?? 0)
    if (a) await confirm(a, user.id, deps.io)
    else await deps.io.send(user.id, 'Solicitação indisponível. Abra Adicionar membro novamente.', back)
    return true
  }
  if (data === 'team:add') {
    const a = await deps.repo.start(user.id)
    const id = await deps.io.send(user.id, 'Peça ao colega para abrir este bot e enviar /id.\nResponda a esta mensagem com o ID numérico e o nome dele, por exemplo: 123456789 Maria Silva.\nA liberação só acontece depois da sua confirmação.', undefined, true)
    await deps.repo.prompt(a.id, user.id, id)
    return true
  }
  const remove = data.match(/^team:remove:(\d{1,16})$/)
  if (remove) {
    const id = Number(remove[1])
    if (!Number.isSafeInteger(id) || deps.owners.includes(id)) { await deps.io.send(user.id, 'O acesso do proprietário é protegido.', back); return true }
    const member = await deps.repo.member(id)
    if (!member?.active) { await deps.io.send(user.id, 'Esse membro já está sem acesso.', back); return true }
    await confirm(await deps.repo.revoke(user.id, member), user.id, deps.io)
    return true
  }
  const action = data.match(new RegExp(`^team:(confirm|cancel):(${uuid})$`))
  if (action) {
    if (action[1] === 'cancel') { await deps.repo.cancel(action[2], user.id); await deps.io.send(user.id, 'Alteração cancelada.', back); return true }
    const a = await deps.repo.get(action[2], user.id)
    const result = a ? await deps.repo.apply(a.id, user.id, deps.owners) : 'unavailable'
    const message = result === 'applied' ? `${a!.kind === 'grant' ? 'Acesso liberado' : 'Acesso removido'}: ${a!.target_name} (ID ${a!.target_id}).` : result === 'done' ? 'Esta alteração já foi concluída.' : 'Confirmação expirada, protegida ou desatualizada. Confira a equipe e prepare uma nova alteração.'
    await deps.io.send(user.id, message, back)
    return true
  }
  const page = data.match(/^team:list:(\d{1,6})$/)
  if (page || /^\/equipe(?:\s|$)/.test(text)) {
    const offset = page ? Number(page[1]) : 0
    const result = await deps.repo.list(offset)
    const buttons: Button[][] = [[{ text: 'Adicionar membro', callback_data: 'team:add' }], ...result.members.filter(m => !deps.owners.includes(m.user_id)).map(m => [{ text: `Remover ${m.name}`.slice(0, 64), callback_data: `team:remove:${m.user_id}` }])]
    const nav: Button[] = []
    if (offset) nav.push({ text: 'Página anterior', callback_data: `team:list:${Math.max(0, offset - 10)}` })
    if (offset + 10 < result.total) nav.push({ text: 'Próxima página', callback_data: `team:list:${offset + 10}` })
    if (nav.length) buttons.push(nav)
    await deps.io.send(user.id, `Equipe de suporte\nSeu acesso de proprietário está protegido.\n${result.total} operadores ativos.\n\n${result.members.map(m => `${m.name} — ID ${m.user_id}`).join('\n') || 'Nenhum operador nesta página.'}\n\nOs operadores podem consultar, corrigir e reenviar acessos. Relatórios continuam restritos aos destinatários configurados.`, buttons)
    return true
  }
  await deps.io.send(user.id, 'Botão de equipe indisponível.', back)
  return true
}
