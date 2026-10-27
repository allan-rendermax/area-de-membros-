import { createAdminClient } from '@/lib/supabase/admin'
import type { TelegramConfig } from './config'

export function teamOwners(): number[] {
  const raw = process.env.TELEGRAM_OWNER_USER_IDS?.trim()
  if (!raw) return []
  const values = raw.split(',').map(s => s.trim())
  if (values.some(s => !/^\d+$/.test(s) || !Number.isSafeInteger(Number(s)) || Number(s) <= 0)) throw new Error('telegram_owner_config_invalid')
  return [...new Set(values.map(Number))]
}
export async function isSupportUser(userId: number, config: TelegramConfig): Promise<boolean> {
  const owners = teamOwners()
  // Legacy mode is retained until the owner configuration has been explicitly deployed.
  if (!owners.length) return config.allowedUsers.includes(userId)
  if (owners.includes(userId)) return true
  const { data, error } = await createAdminClient().from('telegram_support_members').select('active').eq('user_id', userId).maybeSingle()
  if (error) throw new Error('telegram_members_unavailable')
  return data?.active === true
}
