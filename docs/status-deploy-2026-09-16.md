# Estado da publicação — 16/09/2026

## Concluído nesta sessão

- Site de produção: https://area-de-membros-taupe.vercel.app
- Admin: https://area-de-membros-taupe.vercel.app/admin/entrar
- Webhook: https://area-de-membros-taupe.vercel.app/api/webhooks/payt
- Vercel, equipe `rendermax`, projeto `area-de-membros-`: configurações atualizadas nos ambientes Production e Preview.
- `APP_URL=https://area-de-membros-taupe.vercel.app` e `EMAIL_FROM=acesso@grupoelevamax.com` (remetente atualizado em Production, Preview e `.env.local`).
- Valores de `SUPABASE_SECRET_KEY`, `PAYT_INTEGRATION_KEY`, `RESEND_API_KEY`, `ADMIN_EMAILS` e `DEFAULT_STORE_SLUG` atualizados a partir do `.env.local`, sem colocar segredos no repositório.
- Adicionadas `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` como Config. Todos os clientes Supabase deste app executam no servidor. O código aceita essas variáveis e mantém os nomes antigos como fallback para desenvolvimento local.
- As duas variáveis antigas `NEXT_PUBLIC_SUPABASE_*` continuam cadastradas. A Vercel as classificava como Secret e recusava editar valores com prefixo público. Elas não são necessárias quando as novas variáveis estão presentes.
- Corrigido o erro 500 de produção causado pela configuração de conexão ausente no cliente Supabase do proxy.
- Commit publicado: `22ee544` (`fix: use server runtime Supabase configuration on Vercel`).
- Deploy mais recente confirmado Ready: https://vercel.com/rendermax/area-de-membros-/D6LSx3zk7awh9QLKRdevNbZNDyCE — commit `eec0db2`, incluindo formulário que aceita códigos com mais de seis dígitos e configuração nova de remetente.
- Supabase Authentication → URL Configuration: Site URL atualizado para a URL de produção.

## Verificações realizadas

- `npm test`: 47 testes passaram.
- `npm run lint`: sem erros.
- `npm run build`: concluído com sucesso.
- Produção: `/entrar` e `/admin/entrar` retornam HTTP 200.
- Sem sessão: `/` redireciona para `/entrar`; `/admin` e `/admin/materiais` redirecionam para `/admin/entrar`.
- Webhook: chave inválida retorna 401; chave local válida com payload incompleto retorna 400, confirmando autenticação e validação do corpo. Não foi feita compra real na Payt.
- Login no navegador com o cliente de teste já existente (`grupoelevamax@gmail.com`) funcionou.
- Vitrine: Atlas liberado e três bônus bloqueados; o painel de detalhes do bônus abre.
- Cliente autenticado não consegue acessar `/admin`; email do cliente é rejeitado no login do admin com “Email não autorizado.”
- Tentativa real de solicitar código no login do admin realizada após configurar SMTP; o envio ainda depende da verificação do domínio no Resend. Autenticação do administrador ainda não concluída.
- Tentativa de email de configuração para `grupoelevamax@gmail.com` via API Resend retornou HTTP 403: domínio ainda não verificado. Nenhum email foi enviado nessa tentativa.

## Configuração de email — 16/09, à noite

- Domínio `grupoelevamax.com` cadastrado no Resend, região São Paulo (`sa-east-1`), ID `959c5a59-3141-473a-8618-e5a1260d0ab2`.
- Hostinger: adicionados os três registros exigidos pelo painel atual do Resend, preservando A e CNAME preexistentes:
  - TXT `resend._domainkey`: chave pública DKIM copiada integralmente do Resend (TTL padrão 14400).
  - CNAME `rsend` → `rsend-sae1.forge.rmta.net` (TTL 3600).
  - CNAME `send` → `send.forge.rmta.net` (TTL 3600).
- O painel atual pediu dois CNAMEs, em vez do MX e TXT SPF do print antigo. Os valores atuais do serviço foram usados.
- DNS público: TXT confere byte a byte com o valor Resend tanto em `1.1.1.1` como em `8.8.8.8`; CNAMEs também publicados.
- Supabase SMTP próprio habilitado e salvo: `smtp.resend.com`, porta 465, usuário `resend`, senha proveniente da chave Resend existente. Remetente `acesso@grupoelevamax.com`, nome `Área de Membros`. Intervalo mínimo por usuário mantido em 60 segundos.
- Templates **Magic link or OTP** e **Confirm sign up** salvos com assunto `Seu código de acesso` e corpo com `{{ .Token }}`. O segundo cobre o primeiro acesso quando a conta ainda não existe.
- Verificação solicitada no Resend pela interface e API. Após cerca de oito minutos do cadastro, o serviço voltou de `pending` para `not_started`; os dois CNAMEs aparecem `verified`, enquanto o DKIM volta a `not_started`, mesmo com TXT exatamente igual em dois resolvedores públicos. A API de envio ainda bloqueia o domínio com HTTP 403. A causa dessa reversão não foi confirmada; não presumir que basta trocar o DNS.
- Não houve compra real, alteração de checkout ou remoção de dados de teste.

## Pendências concretas

### Rechecagem em 17/09/2026 pela manhã

- Cerca de 11 horas após o cadastro, API e painel do Resend mostravam domínio `failed`, DKIM `failed` e ambos os CNAMEs `verified`.
- Comparação atual confirmou os três valores exatos em Google DNS (`8.8.8.8`) e Cloudflare DNS (`1.1.1.1`).
- Os servidores autoritativos `aurora.dns-parking.com` e `nebula.dns-parking.com` também retornam a chave DKIM correta, sem registro TXT duplicado na resposta.
- Página oficial https://resend-status.com/ informava operação normal. Isso não exclui falha específica de domínio.
- Executado **Restart** uma vez no domínio existente, sem editar DNS. Estado imediato: `pending`. Evidências sugerem problema no processo de validação do Resend; causa interna não confirmada.
- Se a nova tentativa não concluir, encaminhar ao suporte Resend: domínio e ID acima, região `sa-east-1`, DKIM falhando apesar de igualdade exata do TXT em ambos os servidores autoritativos e resolvedores públicos, CNAMEs verificados, e histórico `pending` → `not_started` → `failed`. Nenhum chamado foi enviado.

1. **Concluir verificação do Resend.** DNS, SMTP, templates e remetente já estão configurados. Consultar o domínio existente; não recriar registros nem domínio. Após intervalo de propagação, tentar novamente; se continuar voltando a `not_started`, investigar com suporte Resend usando o ID acima e a evidência de TXT correto. Quando estiver `verified`, repetir o teste de email.
2. **Concluir teste do admin e entrega ao cliente de teste.** Solicitar código em `/admin/entrar` para `arq.allanp@gmail.com`, usar o código recebido e confirmar acesso ao painel. Repetir email de teste para `grupoelevamax@gmail.com` e conferir entrega. O código não deve ser registrado no relatório.
3. **Aprovação visual do dono.** Prints em `docs/design/`; a direção visual existente foi preservada.
4. **Conteúdo e compra real.** Os downloads e checkouts ainda apontam para `example.com/exemplo-download` e `example.com/exemplo-checkout`. A oferta de teste é `TESTE-ATLAS`. Substituir pelos materiais/links reais e validar o postback real da Payt antes de vender. Os dados de exemplo foram preservados.

### Template salvo em Magic link or OTP e Confirm sign up

Assunto: `Seu código de acesso`

```html
<h2>Código de acesso</h2>
<p>Use este código para entrar na Área de Membros:</p>
<p><strong style="font-size:24px">{{ .Token }}</strong></p>
<p>Se você não solicitou este código, ignore este email.</p>
```

Nenhum domínio foi comprado, plano pago contratado ou integração de checkout real alterada nesta sessão.
