# Migração DNS — grupoelevamax.com

Solicitada explicitamente pelo usuário em 17/09/2026. Escopo: administrar o DNS existente pela Cloudflare; nenhum novo subdomínio ou vínculo à Vercel foi solicitado.

- Conta Cloudflare: `6566c9f118f51e7fbfc502f671200b7d`.
- Zona: `6ad630c02eca4bfea56d12fefd155d79`, plano gratuito.
- Registros atuais conferidos na Hostinger e preservados na Cloudflare: A `@` → `2.57.91.91`; CNAME `www` → `grupoelevamax.com`.
- Ambos configurados como Somente DNS, preservando acesso direto à hospedagem atual.
- Nameservers anteriores: `aurora.dns-parking.com`, `nebula.dns-parking.com`.
- Nameservers novos salvos e confirmados na Hostinger: `lamar.ns.cloudflare.com`, `lindsey.ns.cloudflare.com`.
- Consulta pública de DS antes da mudança não encontrou registro. Nenhuma configuração DNSSEC foi alterada.
- Consultas diretas aos dois servidores Cloudflare retornaram os valores corretos de A e CNAME. O resolvedor `1.1.1.1` já retornou os dois novos NS.
- Cloudflare inicialmente indicou aguardar propagação; verificação manual solicitada após confirmar os novos NS publicamente.

## Resend

Ao iniciar esta migração, os registros do Resend já não constavam na Hostinger nem nas consultas públicas. O antigo ID `959c5a59-3141-473a-8618-e5a1260d0ab2` retornou 404 na API. Não foram recriados registros com valores antigos: uma configuração futura precisa usar os valores atuais fornecidos pelo Resend.

Registro e renovação do domínio continuam na Hostinger. A área de membros permanece no endereço Vercel já publicado.
