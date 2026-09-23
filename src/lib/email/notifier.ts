import type { AccessNotice, EmailKind, NoticeResult } from '@/lib/domain/types'
import { accessNoticeEmail } from './access-template'

export type OutgoingEmail = { from: string; to: string; subject: string; html: string; replyTo?: string }

export interface EmailTransport {
  send(email: OutgoingEmail): Promise<{ providerId: string | null }>
}

export type EmailLogStart = { storeId: string; customerId: string; toEmail: string; kind: EmailKind; productIds: string[] }

export type EmailLogFinish = { status: 'enviado'; providerId: string | null } | { status: 'falhou'; error: string }

export interface EmailLogRepo {
  start(entry: EmailLogStart): Promise<string>
  finish(id: string, result: EmailLogFinish): Promise<void>
}

export type NoticeOutcome = NoticeResult & { logId: string }

export function formatFrom(storeName: string, emailFrom: string): string {
  const address = emailFrom.match(/<([^>]+)>/)?.[1]?.trim() ?? emailFrom.trim()
  const name = storeName.replace(/["<>\r\n]/g, '').replace(/\s+/g, ' ').trim()
  return name ? `"${name}" <${address}>` : address
}

export function loginUrlFor(appUrl: string, storeSlug: string, email: string): string {
  return `${appUrl.replace(/\/$/, '')}/${storeSlug}/entrar?email=${encodeURIComponent(email)}`
}

export async function sendAccessNotice(
  notice: AccessNotice,
  deps: { log: EmailLogRepo; transport: EmailTransport; appUrl: string; emailFrom: string; emailReplyTo?: string },
): Promise<NoticeOutcome> {
  const logId = await deps.log.start({
    storeId: notice.store.id,
    customerId: notice.customerId,
    toEmail: notice.to,
    kind: notice.kind,
    productIds: notice.products.map((p) => p.id),
  })

  try {
    const { subject, html } = accessNoticeEmail(notice, loginUrlFor(deps.appUrl, notice.store.slug, notice.to))
    const { providerId } = await deps.transport.send({
      from: formatFrom(notice.store.name, deps.emailFrom),
      to: notice.to,
      subject,
      html,
      ...(deps.emailReplyTo ? { replyTo: deps.emailReplyTo } : {}),
    })
    await deps.log.finish(logId, { status: 'enviado', providerId })
    return { ok: true, logId }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await deps.log.finish(logId, { status: 'falhou', error })
    return { ok: false, error, logId }
  }
}
