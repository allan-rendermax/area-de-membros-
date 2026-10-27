import { escapeHtml } from '@/lib/email/html'

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
}

export function downloadRedirect(destination: string): Response {
  return new Response(null, { status: 307, headers: { ...privateHeaders, Location: destination } })
}

export function downloadUnavailable(retryPath: string, materialPath: string): Response {
  return new Response(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tente baixar novamente · Área de Membros</title>
<style>body{margin:0;background:#0b0b0c;color:#f4f4f5;font:16px/1.6 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}main{max-width:30rem;padding:2rem}h1{font-size:1.7rem;line-height:1.2}p{color:#b5b5bc}a{display:block;padding:.85rem 1rem;border-radius:.7rem;color:inherit;text-align:center;text-decoration:none;margin-top:1rem;border:1px solid #52525b}a:first-of-type{background:#f4f4f5;color:#18181b;font-weight:700}a:focus-visible{outline:3px solid #a5b4fc;outline-offset:4px}</style></head>
<body><main><h1>Não foi possível preparar seu download agora</h1><p>Tente novamente em alguns instantes. Você também pode voltar ao material e iniciar o download por lá.</p>
<a href="${escapeHtml(retryPath)}">Tentar baixar novamente</a><a href="${escapeHtml(materialPath)}">Voltar ao material</a></main></body></html>`, {
    status: 503,
    headers: {
      ...privateHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': '10',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    },
  })
}
