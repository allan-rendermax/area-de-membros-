import type { AccessNotice, EmailKind } from '@/lib/domain/types'
import { escapeHtml } from './html'
import { getMemberTheme } from '@/lib/membros/theme'

const COPY: Record<EmailKind, { subject: string; heading: string; intro: string; instructions: string; footer: string }> = {
  acesso_novo: {
    subject: 'Seus materiais estão liberados',
    heading: 'Tudo pronto para<br>você começar.',
    intro: 'Sua compra foi confirmada. Você já pode acessar seus materiais na área de membros da',
    instructions: 'Seu primeiro acesso, sem complicação',
    footer: 'Você recebeu este e-mail porque uma compra foi confirmada para este endereço.',
  },
  produto_novo: {
    subject: 'Novo produto liberado',
    heading: 'Tem material novo<br>esperando por você.',
    intro: 'Novos materiais já estão disponíveis para você na área de membros da',
    instructions: 'Acesse com o mesmo e-mail',
    footer: 'Você recebeu este e-mail porque novos materiais foram liberados para este endereço.',
  },
  reenvio: {
    subject: 'Seu acesso',
    heading: 'Seu acesso,<br>sempre à mão.',
    intro: 'Aqui está o link para acessar seus materiais na área de membros da',
    instructions: 'Volte aos seus materiais',
    footer: 'Este e-mail é um reenvio do seu acesso à área de membros.',
  },
}

export function accessNoticeEmail(notice: AccessNotice, loginUrl: string): { subject: string; html: string } {
  const architecture = getMemberTheme(notice.store.slug) === 'arquitetura'
  // Keep the approved light layout; only brand accents vary by store.
  const theme = {
    background: '#eeeded', surface: '#ffffff', inset: '#f7f6f5', border: '#dedee1',
    text: '#242426', muted: '#626266', body: '#515156', header: '#202022',
    accent: architecture ? '#ff5a16' : '#c8192b',
    action: architecture ? '#ffd53d' : '#c8192b',
    ink: architecture ? '#171717' : '#ffffff',
    link: architecture ? '#a63b0f' : '#a71626',
  }
  const copy = COPY[notice.kind]
  const store = escapeHtml(notice.store.name)
  const subject = (notice.kind === 'acesso_novo' && notice.products.length === 1
    ? `Seu acesso: ${notice.products[0].title} — liberado`
    : `${copy.subject} — ${notice.store.name}`).replace(/[\r\n]+/g, ' ')
  const firstName = notice.customerName.trim().split(/\s+/)[0]
  const greeting = firstName ? `Olá, ${escapeHtml(firstName)}!` : 'Olá!'
  const href = escapeHtml(loginUrl)
  const brand = `${store}<span style="color:${theme.accent}">.</span>`
  const products = notice.products.length ? `<tr><td class="product" style="padding:0 42px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${theme.border};border-bottom:1px solid ${theme.border}"><tr><td style="padding:22px 0">
<p style="margin:0 0 10px;font-size:13px;color:${theme.muted}">${notice.products.length === 1 ? 'Material liberado para você' : 'Materiais liberados para você'}</p>
${notice.products.map((p, i) => `<h2 style="margin:${i ? '16px' : '0'} 0 0;font-size:22px;line-height:1.3;overflow-wrap:anywhere">${escapeHtml(p.title)}</h2>`).join('')}
</td></tr></table></td></tr>` : ''

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${store} — Área de membros</title>
<style>p{margin:0}a:focus-visible{outline:3px solid ${theme.action};outline-offset:5px}@media(max-width:480px){.pad,.product{padding-left:24px!important;padding-right:24px!important}.title{font-size:32px!important}.outer{padding:16px 12px!important}}</style>
</head><body style="margin:0;background:${theme.background};color:${theme.text};font-family:Arial,Helvetica,sans-serif">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(copy.subject)}. Entre com o e-mail da compra, sem senha.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="outer" align="center" style="padding:32px 20px">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table class="frame" width="100%" style="max-width:600px;border-collapse:collapse;background:${theme.surface}" role="presentation" cellpadding="0" cellspacing="0">
<tr><td style="padding:24px 42px;background:${theme.header};color:#fff;border-bottom:4px solid ${theme.accent}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:21px;letter-spacing:-.5px;font-weight:bold">${brand}</td><td align="right" style="font-size:12px;color:#d3d3d6">Área de membros</td></tr></table></td></tr>
<tr><td class="pad" style="padding:36px 42px 28px">
<h1 class="title" style="margin:0 0 24px;font-size:38px;line-height:1.12;letter-spacing:-1.2px;font-weight:bold">${copy.heading}</h1>
<p style="margin:0;font-size:16px;line-height:1.65;margin-bottom:12px">${greeting}</p>
<p style="margin:0;font-size:16px;line-height:1.65;color:${theme.body}">${copy.intro} <strong style="color:${theme.text}">${store}</strong>.</p>
</td></tr>
${products}
<tr><td class="pad" style="padding:28px 42px 30px">
<a class="button" style="display:block;padding:18px 20px;background:${theme.action};color:${theme.ink};text-align:center;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold" href="${href}">Acessar meus materiais</a>
<p style="margin:0;text-align:center;font-size:12px;line-height:1.6;color:${theme.muted};margin-top:12px">No celular ou no computador. Sem criar uma senha.</p>

</td></tr>
<tr><td class="pad" style="background:${theme.inset};padding:26px 42px 28px">
<h2 style="font-size:18px;margin:0 0 12px">${copy.instructions}</h2>
<p style="margin:0;font-size:14px;line-height:1.75;color:${theme.body}">Clique no botão acima, confira o e-mail na página de acesso e selecione <strong style="color:${theme.text}">Entrar</strong>. Pronto: seus materiais estarão lá.</p>
<p style="margin:0;font-size:12px;color:${theme.muted};margin-top:20px;margin-bottom:5px">Use o mesmo e-mail da compra:</p>
<p style="margin:0;font-size:15px;font-weight:bold;overflow-wrap:anywhere">${escapeHtml(notice.to)}</p>
</td></tr>
<tr><td class="pad" style="padding:26px 42px 28px"><p style="margin:0;font-size:13px;line-height:1.7;color:${theme.muted}">Guarde este e-mail para encontrar seu acesso sempre que precisar.</p><p style="margin:0;font-size:12px;line-height:1.7;color:${theme.muted};margin-top:14px">O botão não abriu? <a href="${href}" style="color:${theme.link};text-decoration:underline;text-underline-offset:3px">Use este link para acessar.</a></p></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<div class="footer" style="max-width:600px;padding:22px 36px 0;text-align:center;font-size:11px;line-height:1.7;color:${theme.muted}">${store} · Área de membros<br>${copy.footer}</div>
</td></tr></table>
</body>
</html>`

  return { subject, html }
}
