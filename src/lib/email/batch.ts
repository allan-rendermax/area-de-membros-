import type { AccessNotice } from '@/lib/domain/types'
import type { NoticeOutcome } from './notifier'

export type FailedEmail = { id: string; storeId: string | null; customerId: string | null; toEmail: string; createdAt: string }

export type BatchGroup = { storeId: string; customerId: string; toEmail: string; logIds: string[] }

export type BatchSummary = { sent: number; failed: number; skipped: number; remaining: number }

export const MAX_RESEND_PER_RUN = 100

export function groupFailedEmails(failed: FailedEmail[]): BatchGroup[] {
  const groups = new Map<string, BatchGroup>()
  const sorted = [...failed].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  for (const entry of sorted) {
    if (!entry.storeId || !entry.customerId) continue
    const key = `${entry.customerId}|${entry.storeId}`
    const group = groups.get(key)
    if (group) group.logIds.push(entry.id)
    else groups.set(key, { storeId: entry.storeId, customerId: entry.customerId, toEmail: entry.toEmail, logIds: [entry.id] })
  }
  return [...groups.values()]
}

export async function runResendBatch(deps: {
  listUnresolvedFailed(): Promise<FailedEmail[]>
  countUsedToday(): Promise<number>
  dailyLimit: number
  buildNotice(group: BatchGroup): Promise<AccessNotice | null>
  send(notice: AccessNotice): Promise<NoticeOutcome>
  markResolved(logIds: string[], resolvedBy: string): Promise<void>
}): Promise<BatchSummary> {
  const groups = groupFailedEmails(await deps.listUnresolvedFailed())
  const slots = Math.max(0, Math.min(deps.dailyLimit - (await deps.countUsedToday()), MAX_RESEND_PER_RUN))
  const summary: BatchSummary = { sent: 0, failed: 0, skipped: 0, remaining: groups.length }
  let attempted = 0
  let visited = 0

  for (const group of groups) {
    if (attempted >= slots) break
    visited++
    const notice = await deps.buildNotice(group)
    if (!notice) {
      summary.skipped++
      continue
    }
    attempted++
    const result = await deps.send(notice)
    if (result.ok) {
      summary.sent++
      await deps.markResolved(group.logIds, result.logId)
    } else {
      summary.failed++
    }
  }
  summary.remaining = groups.length - visited
  return summary
}
