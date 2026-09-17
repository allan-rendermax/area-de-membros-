import type { AccessNotice, EmailKind } from '@/lib/domain/types'
import { escapeHtml } from './html'

const SUBJECTS: Record<EmailKind, string> = {
  acesso_novo: 'Seu acesso chegou',
  produto_novo: 'Novo produto liberado',
  reenvio: 'Seu acesso',
}

const INTROS: Record<EmailKind, string> = {
  acesso_novo: 'Sua compra foi confirmada e sua área de membros já está liberada.',
  produto_novo: 'Um novo produto foi liberado na sua área de membros.',
  reenvio: 'Aqui está o seu acesso à área de membros.',
}

export function accessNoticeEmail(notice: AccessNotice, loginUrl: string): { subject: string; html: string } {
  const store = escapeHtml(notice.store.name)
  const subject = `${SUBJECTS[notice.kind]} — ${notice.store.name}`
  const firstName = notice.customerName.trim().split(/\s+/)[0]
  const greeting = firstName ? `Olá, ${escapeHtml(firstName)}!` : 'Olá!'
  const list = notice.products.length
    ? `<ul style="padding-left:20px;margin:16px 0">${notice.products
        .map((p) => `<li style="margin:4px 0">${escapeHtml(p.title)}</li>`)
        .join('')}</ul>`
    : ''

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
<p style="margin:0 0 8px;font-size:13px;color:#71717a">${store}</p>
<h1 style="margin:0 0 16px;font-size:22px">${greeting}</h1>
<p style="margin:0;font-size:16px;line-height:1.5">${INTROS[notice.kind]}</p>
${list}
<p style="margin:24px 0"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#e11d2e;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold">Acessar meus produtos</a></p>
<p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">Para entrar, use este mesmo e-mail: ${escapeHtml(notice.to)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`

  return { subject, html }
}
