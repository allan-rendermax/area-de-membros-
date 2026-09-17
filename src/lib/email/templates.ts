import type { AccessEmail } from '@/lib/orders/process-postback'
import { escapeHtml } from './html'

export { escapeHtml }

export function accessGrantedEmail(input: AccessEmail & { loginUrl: string }): { subject: string; html: string } {
  const store = escapeHtml(input.storeName)
  const subject = input.firstAccess
    ? `Seu acesso chegou — ${input.storeName}`
    : `Novo material liberado — ${input.storeName}`
  const greeting = input.customerName ? `Olá, ${escapeHtml(input.customerName.split(' ')[0])}!` : 'Olá!'
  const intro = input.firstAccess
    ? 'Sua compra foi confirmada e sua área de membros já está liberada.'
    : 'Um novo material foi liberado na sua área de membros.'
  const list = input.materialTitles.length
    ? `<ul style="padding-left:20px;margin:16px 0">${input.materialTitles
        .map((t) => `<li style="margin:4px 0">${escapeHtml(t)}</li>`)
        .join('')}</ul>`
    : ''

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
<p style="margin:0 0 8px;font-size:13px;color:#71717a">${store}</p>
<h1 style="margin:0 0 16px;font-size:22px">${greeting}</h1>
<p style="margin:0;font-size:16px;line-height:1.5">${intro}</p>
${list}
<p style="margin:24px 0"><a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold">Acessar meus materiais</a></p>
<p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">Para entrar, use este mesmo email: ${escapeHtml(input.to)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`

  return { subject, html }
}
