import { describe, expect, it, vi } from 'vitest'
import { handleTeamUpdate, parseMember, type TeamDeps } from '@/lib/telegram/team'
const id = '00000000-0000-4000-8000-000000000001'
function setup() {
  const a = { id, kind: 'grant' as const, state: 'confirm', target_id: 456, target_name: 'Maria' }
  const deps: TeamDeps = {
    owners: [123], io: { edit: vi.fn(), send: vi.fn().mockResolvedValue(10), ack: vi.fn() }, acceptUpdate: vi.fn().mockResolvedValue(true),
    repo: { list: vi.fn().mockResolvedValue({members:[],total:0}), member: vi.fn().mockResolvedValue(null), start: vi.fn().mockResolvedValue(a), prompt: vi.fn(), reply: vi.fn().mockResolvedValue(null), prepare: vi.fn().mockResolvedValue(a), revoke: vi.fn().mockResolvedValue(a), get: vi.fn().mockResolvedValue(a), apply: vi.fn().mockResolvedValue('applied'), cancel: vi.fn() },
  }
  return { deps, a }
}
function callback(data: string, user=123) { return { update_id: 1, callback_query: { id: 'cb', data, from: {id:user}, message: {message_id:2,chat:{id:user,type:'private'}} } } }
describe('gerenciar equipe', () => {
  it('nega callbacks de operador antes de ler ou alterar a equipe', async () => {
    const {deps}=setup()
    await handleTeamUpdate(callback(`team:confirm:${id}`,456),deps)
    expect(deps.repo.apply).not.toHaveBeenCalled();expect(deps.repo.get).not.toHaveBeenCalled()
    expect(deps.io.send).toHaveBeenCalledWith(456,expect.stringContaining('Somente o proprietário'))
  })
  it('mostra menu somente ao proprietário e ignora grupos e remetente divergente', async () => {
    const {deps}=setup()
    const u={update_id:1,message:{message_id:2,from:{id:123},chat:{id:123,type:'private'},text:'/start'}}
    expect(await handleTeamUpdate(u,deps)).toBe(true)
    expect(deps.io.send).toHaveBeenCalledWith(123,expect.any(String),expect.arrayContaining([[{text:'👥 Gerenciar equipe',callback_data:'team:list:0'}]]))
    vi.mocked(deps.io.send).mockClear(); u.message.chat.type='group'
    expect(await handleTeamUpdate(u,deps)).toBe(false);expect(deps.io.send).not.toHaveBeenCalled()
  })
  it('coleta ID e nome por resposta e só prepara a confirmação', async () => {
    const {deps,a}=setup();vi.mocked(deps.repo.reply).mockResolvedValue(a)
    await handleTeamUpdate({update_id:2,message:{message_id:3,from:{id:123},chat:{id:123,type:'private'},reply_to_message:{message_id:10},text:'456 Maria'}},deps)
    expect(deps.repo.prepare).toHaveBeenCalledWith(id,123,456,'Maria',0)
    expect(deps.repo.apply).not.toHaveBeenCalled()
    expect(deps.io.send).toHaveBeenCalledWith(123,expect.stringContaining('ID Telegram: <code>456</code>'),expect.any(Array))
  })
  it('não remove proprietário nem repete updates', async () => {
    const {deps}=setup();await handleTeamUpdate(callback('team:remove:123'),deps)
    expect(deps.repo.revoke).not.toHaveBeenCalled()
    vi.mocked(deps.acceptUpdate).mockResolvedValue(false)
    await handleTeamUpdate(callback(`team:confirm:${id}`),deps);expect(deps.repo.apply).not.toHaveBeenCalled()
  })
  it('vincula confirmação ao proprietário e não promete sucesso em conflito', async () => {
    const {deps}=setup();vi.mocked(deps.repo.apply).mockResolvedValue('stale')
    await handleTeamUpdate(callback(`team:confirm:${id}`),deps)
    expect(deps.repo.apply).toHaveBeenCalledWith(id,123,[123])
    expect(deps.io.edit).toHaveBeenCalledWith(123,2,expect.stringContaining('desatualizada'),expect.any(Array))
  })
  it.each(['@maria Maria','0 Maria','9007199254740992 Maria','123 Maria\n456 João','123', '123 '+ 'x'.repeat(81)])('rejeita identidade inválida: %s',text=>expect(parseMember(text)).toBeNull())
  it('aceita ID numérico e nome legível',()=>expect(parseMember('456 Maria Silva')).toEqual({id:456,name:'Maria Silva'}))
})

it('compartilha boas-vindas com handler e mantém equipe só para proprietário', async () => {
  const { deps } = setup()
  const { handleTelegramUpdate } = await import('@/lib/telegram/handler')
  const { welcome } = await import('@/lib/telegram/format')
  const update = { update_id: 10, message: { message_id: 2, from: { id: 123 }, chat: { id: 123, type: 'private' }, text: '/start' } }
  await handleTeamUpdate(update, deps)
  const ownerText = vi.mocked(deps.io.send).mock.calls[0][1]
  expect(ownerText).toBe(welcome(true))
  const support = { io: deps.io, allowedUsers: [123], owners: [123], now: () => new Date(), repo: { acceptUpdate: vi.fn().mockResolvedValue(true) }, ops: {} } as unknown as import('@/lib/telegram/types').SupportDeps
  for (const text of ['/start', '/help', 'ajuda']) {
    await handleTelegramUpdate({ ...update, message: { ...update.message, text } }, support)
    expect(vi.mocked(deps.io.send).mock.lastCall?.[1]).toBe(ownerText)
  }
  support.owners = []
  await handleTelegramUpdate(update, support)
  expect(vi.mocked(deps.io.send).mock.lastCall?.[1]).toBe(welcome(false))
  expect(vi.mocked(deps.io.send).mock.lastCall?.[2]?.flat().some(b => b.callback_data.startsWith('team:'))).toBe(false)
})
it('formata equipe com escape, estilos e paginação editável', async () => {
  const { deps } = setup()
  vi.mocked(deps.repo.list).mockResolvedValue({ members: [{ user_id: 456, name: '<b>&', active: true, version: 1 }], total: 11 })
  await handleTeamUpdate(callback('team:list:0'), deps)
  expect(deps.io.send).toHaveBeenCalledWith(123, expect.stringContaining('&lt;b&gt;&amp;'), expect.any(Array))
  const buttons = vi.mocked(deps.io.send).mock.lastCall![2]!.flat()
  expect(buttons).toContainEqual(expect.objectContaining({ style: 'primary', callback_data: 'team:add' }))
  expect(buttons).toContainEqual(expect.objectContaining({ style: 'danger', callback_data: 'team:remove:456' }))
  await handleTeamUpdate(callback('team:page:10'), deps)
  expect(deps.repo.list).toHaveBeenLastCalledWith(10)
  expect(deps.io.edit).toHaveBeenCalledWith(123, 2, expect.any(String), expect.any(Array))
})
it.each(['grant', 'revoke'] as const)('confirmação de %s usa estilo e resultado é editado com escape', async kind => {
  const { deps, a } = setup()
  const change = { ...a, kind, target_name: '<b>&' }
  vi.mocked(deps.repo.get).mockResolvedValue(change)
  if (kind === 'grant') {
    vi.mocked(deps.repo.reply).mockResolvedValue(change)
    vi.mocked(deps.repo.prepare).mockResolvedValue(change)
    await handleTeamUpdate({ update_id: 2, message: { message_id: 3, from: { id: 123 }, chat: { id: 123, type: 'private' }, reply_to_message: { message_id: 10 }, text: '456 <b>&' } }, deps)
    expect(vi.mocked(deps.io.send).mock.lastCall![2]!.flat()).toContainEqual(expect.objectContaining({ style: 'success' }))
  } else {
    vi.mocked(deps.repo.member).mockResolvedValue({ user_id: 456, name: '<b>&', active: true, version: 1 })
    vi.mocked(deps.repo.revoke).mockResolvedValue(change)
    await handleTeamUpdate(callback('team:remove:456'), deps)
    expect(vi.mocked(deps.io.edit).mock.lastCall![3]!.flat()).toContainEqual(expect.objectContaining({ style: 'danger' }))
  }
  await handleTeamUpdate(callback(`team:confirm:${id}`), deps)
  expect(deps.io.edit).toHaveBeenLastCalledWith(123, 2, expect.stringContaining('&lt;b&gt;&amp;'), expect.any(Array))
  await handleTeamUpdate(callback(`team:cancel:${id}`), deps)
  expect(deps.io.edit).toHaveBeenLastCalledWith(123, 2, '✖️ Alteração cancelada.', expect.any(Array))
})
