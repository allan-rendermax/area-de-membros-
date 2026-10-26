import { createAdminClient } from '@/lib/supabase/admin'
import { getStoreBySlug } from '@/lib/data/stores'
import { env } from '@/lib/env'
import { createTelegramClient } from './client'
import { getTelegramConfig } from './config'
import { isSupportUser } from './team-access'
import { dailyReport, menu, reportWindow, type DailyMetrics, type FailureList } from './monitoring'

export async function listFailures(storeSlug: string, offset = 0): Promise<FailureList> {
  const store = await getStoreBySlug(storeSlug)
  if (!store) throw new Error('telegram_store_missing')
  const { data, error } = await createAdminClient().rpc('telegram_support_failures', { p_store: store.id, p_offset: offset, p_limit: 10 })
  if (error || !data) throw new Error('telegram_failures_unavailable')
  return data as FailureList
}

export async function syncDelivery() {
  const db = createAdminClient()
  const claim = await db.rpc('telegram_support_claim_job', { p_key: 'email-sync', p_seconds: 300 })
  if (claim.error) throw new Error('telegram_sync_claim_failed')
  if (!claim.data) return { skipped: true }
  const started = Date.now(), cutoff = started - 30 * 86400_000
  let cursor = '', count = 0, finished = false
  try {
    while (Date.now() - started < 240_000) {
      const url = new URL('https://api.resend.com/emails'); url.searchParams.set('limit', '100')
      if (cursor) url.searchParams.set('after', cursor)
      const response = await fetch(url, { headers: { Authorization: `Bearer ${env.resendApiKey}` }, signal: AbortSignal.timeout(10000), cache: 'no-store' })
      if (!response.ok) throw new Error('telegram_provider_list_failed')
      const page = await response.json() as { data: { id: string; last_event: string; subject: string; created_at: string }[]; has_more: boolean }
      if (!Array.isArray(page.data) || typeof page.has_more !== 'boolean') throw new Error('telegram_provider_list_invalid')
      if (page.data.some(e => !e.id || typeof e.last_event !== 'string' || typeof e.subject !== 'string' || !Number.isFinite(Date.parse(e.created_at)))) throw new Error('telegram_provider_row_invalid')
      if (page.data.length) {
        const logs = await db.from('email_log').select('id,provider_id').in('provider_id', page.data.map(e => e.id))
        if (logs.error) throw new Error('telegram_sync_logs_failed')
        const indexed = new Map(page.data.map(e => [e.id, e]))
        const rows = (logs.data ?? []).map(l => {
          const email = indexed.get(l.provider_id)!
          return { log_id: l.id, event: email.last_event, is_access: !/seu convite para o clube/i.test(email.subject), checked_at: new Date().toISOString() }
        })
        if (rows.length) {
          const saved = await db.from('telegram_email_delivery').upsert(rows)
          if (saved.error) throw new Error('telegram_sync_save_failed')
          count += rows.length
        }
      }
      const tail = page.data.at(-1)
      if (!page.has_more || !tail || Date.parse(tail.created_at) < cutoff) { finished = true; break }
      if (cursor === tail.id) throw new Error('telegram_provider_cursor_repeated')
      cursor = tail.id
      await new Promise(resolve => setTimeout(resolve, 700))
    }
    if (!finished) throw new Error('telegram_sync_incomplete')
    const saved = await db.from('telegram_support_jobs').update({ last_success_at: new Date().toISOString() }).eq('key', 'email-sync')
    if (saved.error) throw new Error('telegram_sync_finish_failed')
    return { synced: count }
  } finally {
    await db.from('telegram_support_jobs').update({ lease_until: new Date().toISOString() }).eq('key', 'email-sync')
  }
}

export async function runDailyReport(now = new Date()) {
  const config = getTelegramConfig(), window = reportWindow(now)
  if (!config || !window) return { skipped: true }
  // Recipients are configured separately; granting support access never subscribes someone to reports.
  const configured = [...new Set((process.env.TELEGRAM_REPORT_USER_IDS ?? '').split(',').map(s => Number(s.trim())).filter(id => Number.isSafeInteger(id) && id > 0))]
  const recipients: number[] = []
  for (const id of configured) if (await isSupportUser(id, config)) recipients.push(id)
  if (!recipients.length) return { skipped: true }
  const db = createAdminClient(), store = await getStoreBySlug(config.storeSlug)
  if (!store) throw new Error('telegram_store_missing')
  const { data, error } = await db.rpc('telegram_support_metrics', { p_store: store.id, p_start: window.start, p_end: window.end })
  if (error || !data) throw new Error('telegram_report_metrics_failed')
  const text = dailyReport(store.name, window.date, data as DailyMetrics, await listFailures(config.storeSlug))
  const io = createTelegramClient(config.token)
  let sent = 0
  for (const userId of recipients) {
    const claim = await db.from('telegram_support_reports').insert({ store_id: store.id, report_date: window.date, user_id: userId })
    if (claim.error?.code === '23505') continue
    if (claim.error) throw new Error('telegram_report_claim_failed')
    try {
      const id = await io.send(userId, text, menu)
      const saved = await db.from('telegram_support_reports').update({ state: 'sent', message_id: id }).eq('store_id', store.id).eq('report_date', window.date).eq('user_id', userId)
      if (saved.error) throw new Error('telegram_report_result_failed')
      sent++
    } catch {
      await db.from('telegram_support_reports').update({ state: 'uncertain' }).eq('store_id', store.id).eq('report_date', window.date).eq('user_id', userId)
      throw new Error('telegram_report_send_uncertain')
    }
  }
  return { sent }
}
