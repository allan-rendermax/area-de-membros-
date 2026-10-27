import { createAdminClient } from '@/lib/supabase/admin'
import type { TeamChange, TeamMember, TeamRepository } from './team'

export function createTeamRepository(): TeamRepository {
  const db = createAdminClient()
  const now = () => new Date().toISOString()
  const check = (error: unknown) => { if (error) throw new Error('telegram_team_storage_failed') }
  return {
    async list(offset) {
      const { data, error, count } = await db.from('telegram_support_members').select('*', { count: 'exact' }).eq('active', true).order('user_id').range(offset, offset + 9)
      check(error); return { members: data as TeamMember[], total: count ?? 0 }
    },
    async member(id) {
      const { data, error } = await db.from('telegram_support_members').select('*').eq('user_id', id).maybeSingle()
      check(error); return data as TeamMember | null
    },
    async start(owner) {
      const { data, error } = await db.from('telegram_team_changes').insert({ owner_id: owner, chat_id: owner, kind: 'grant', state: 'input' }).select('*').single()
      check(error); return data as TeamChange
    },
    async prompt(id, owner, messageId) {
      const { error } = await db.from('telegram_team_changes').update({ prompt_id: messageId }).eq('id', id).eq('owner_id', owner).eq('state', 'input')
      check(error)
    },
    async reply(owner, messageId) {
      const { data, error } = await db.from('telegram_team_changes').select('*').eq('owner_id', owner).eq('chat_id', owner).eq('prompt_id', messageId).eq('state', 'input').gt('expires_at', now()).maybeSingle()
      check(error); return data as TeamChange | null
    },
    async prepare(id, owner, target, name, version) {
      const { data, error } = await db.from('telegram_team_changes').update({ target_id: target, target_name: name, expected_version: version, state: 'confirm' }).eq('id', id).eq('owner_id', owner).eq('chat_id', owner).eq('state', 'input').gt('expires_at', now()).select('*').maybeSingle()
      check(error); return data as TeamChange | null
    },
    async revoke(owner, member) {
      const { data, error } = await db.from('telegram_team_changes').insert({ owner_id: owner, chat_id: owner, kind: 'revoke', state: 'confirm', target_id: member.user_id, target_name: member.name, expected_version: member.version }).select('*').single()
      check(error); return data as TeamChange
    },
    async get(id, owner) {
      const { data, error } = await db.from('telegram_team_changes').select('*').eq('id', id).eq('owner_id', owner).eq('chat_id', owner).maybeSingle()
      check(error); return data as TeamChange | null
    },
    async apply(id, owner, owners) {
      const { data, error } = await db.rpc('telegram_team_apply', { p_id: id, p_actor: owner, p_owners: owners })
      check(error); return data as string
    },
    async cancel(id, owner) {
      const { error } = await db.from('telegram_team_changes').update({ state: 'cancelled', finished_at: now() }).eq('id', id).eq('owner_id', owner).eq('chat_id', owner).in('state', ['input', 'confirm'])
      check(error)
    },
  }
}
