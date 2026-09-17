import { loadStoreAccess } from '@/lib/data/access'
import { getCustomer } from '@/lib/data/customers'
import {
  countEmailsUsedToday,
  createEmailLogRepo,
  getEmailLogEntry,
  listUnresolvedFailed,
  markEmailsResolved,
} from '@/lib/data/email-log'
import { getStoreById } from '@/lib/data/stores'
import type { AccessNotice, NoticeResult } from '@/lib/domain/types'
import { env } from '@/lib/env'
import { runResendBatch, type BatchSummary } from './batch'
import { sendAccessNotice, type NoticeOutcome } from './notifier'
import { createResendTransport } from './resend-transport'

export function notifyAccess(notice: AccessNotice): Promise<NoticeOutcome> {
  return sendAccessNotice(notice, {
    log: createEmailLogRepo(),
    transport: createResendTransport(),
    appUrl: env.appUrl,
    emailFrom: env.emailFrom,
  })
}

async function prepareResend(group: { storeId: string; customerId: string }): Promise<{ notice: AccessNotice } | { error: string }> {
  const [store, customer] = await Promise.all([getStoreById(group.storeId), getCustomer(group.customerId)])
  if (!store) return { error: 'Loja não encontrada.' }
  if (!customer) return { error: 'Cliente não encontrado.' }
  if (customer.blockedAt) return { error: 'Cliente bloqueado.' }
  const { products, granted } = await loadStoreAccess(store.id, customer.email)
  const unlocked = products.filter((p) => p.isPublished && granted.has(p.id)).sort((a, b) => a.sortOrder - b.sortOrder)
  if (unlocked.length === 0) return { error: 'Cliente sem produtos liberados nesta loja.' }
  return {
    notice: {
      customerId: customer.id,
      to: customer.email,
      customerName: customer.name,
      store: { id: store.id, slug: store.slug, name: store.name },
      products: unlocked.map((p) => ({ id: p.id, title: p.title })),
      kind: 'reenvio',
    },
  }
}

export async function buildResendNotice(group: { storeId: string; customerId: string }): Promise<AccessNotice | null> {
  const result = await prepareResend(group)
  return 'notice' in result ? result.notice : null
}

export function resendFailedEmails(): Promise<BatchSummary> {
  return runResendBatch({
    listUnresolvedFailed,
    countUsedToday: countEmailsUsedToday,
    dailyLimit: env.emailDailyLimit,
    buildNotice: buildResendNotice,
    send: notifyAccess,
    markResolved: markEmailsResolved,
  })
}

async function sendReenvio(storeId: string, customerId: string): Promise<NoticeOutcome | NoticeResult> {
  if ((await countEmailsUsedToday()) >= env.emailDailyLimit) return { ok: false, error: 'Limite diário de e-mails atingido.' }
  const prepared = await prepareResend({ storeId, customerId })
  if ('error' in prepared) return { ok: false, error: prepared.error }
  return notifyAccess(prepared.notice)
}

export async function resendEmailLogEntry(logId: string): Promise<NoticeResult> {
  const entry = await getEmailLogEntry(logId)
  if (!entry || !entry.storeId || !entry.customerId) return { ok: false, error: 'Registro sem loja ou cliente.' }
  const result = await sendReenvio(entry.storeId, entry.customerId)
  if (result.ok && 'logId' in result) await markEmailsResolved([logId], result.logId)
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

export async function resendAccessForCustomer(customerId: string, storeId: string): Promise<NoticeResult> {
  const result = await sendReenvio(storeId, customerId)
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}
