# Estado da publicação — 16/09/2026

## Concluído nesta sessão

- Site de produção: https://area-de-membros-taupe.vercel.app
- Admin: https://area-de-membros-taupe.vercel.app/admin/entrar
- Webhook: https://area-de-membros-taupe.vercel.app/api/webhooks/payt
- Vercel, equipe `rendermax`, projeto `area-de-membros-`: configurações atualizadas nos ambientes Production e Preview.
- `APP_URL=https://area-de-membros-taupe.vercel.app` e `EMAIL_FROM=onboarding@resend.dev`.
- Valores de `SUPABASE_SECRET_KEY`, `PAYT_INTEGRATION_KEY`, `RESEND_API_KEY`, `ADMIN_EMAILS` e `DEFAULT_STORE_SLUG` atualizados a partir do `.env.local`, sem colocar segredos no repositório.
- Adicionadas `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` como Config. Todos os clientes Supabase deste app executam no servidor. O código aceita essas variáveis e mantém os nomes antigos como fallback para desenvolvimento local.
- As duas variáveis antigas `NEXT_PUBLIC_SUPABASE_*` continuam cadastradas. A Vercel as classificava como Secret e recusava editar valores com prefixo público. Elas não são necessárias quando as novas variáveis estão presentes.
- Corrigido o erro 500 de produção causado pela configuração de conexão ausente no cliente Supabase do proxy.
- Commit publicado: `22ee544` (`fix: use server runtime Supabase configuration on Vercel`).
- Deploy confirmado Ready: https://vercel.com/rendermax/area-de-membros-/86QMhaWNSwoietvzWJLW5yYVMofE
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
- Não foi enviado email de teste nem concluída autenticação do administrador.

## Pendências concretas

1. **Escolher domínio de envio e verificar no Resend.** A conta Resend `grupoelevamax` não tem domínio cadastrado. O remetente de teste fica limitado ao email dono da conta. O admin configurado é `arq.allanp@gmail.com`, diferente desse dono.
2. **Configurar SMTP e template no Supabase.** A interface atual bloqueia edição de assunto/corpo no plano Free sem SMTP próprio. Não foi feito upgrade pago nem alterado o SMTP. Após verificar o domínio, configurar SMTP Resend e então salvar o template abaixo. Conferir também o tamanho e a validade do OTP antes do teste, pois o formulário atual aceita seis dígitos.
3. **Aprovação visual do dono.** Prints em `docs/design/`; a direção visual existente foi preservada.
4. **Conteúdo e compra real.** Os downloads e checkouts ainda apontam para `example.com/exemplo-download` e `example.com/exemplo-checkout`. A oferta de teste é `TESTE-ATLAS`. Substituir pelos materiais/links reais e validar o postback real da Payt antes de vender. Os dados de exemplo foram preservados.

### Template planejado para Magic link or OTP

Assunto: `Seu código de acesso`

```html
<h2>Código de acesso ao admin</h2>
<p>Seu código: <strong style="font-size:24px">{{ .Token }}</strong></p>
<p>Ele expira em alguns minutos. Se não foi você, ignore este email.</p>
```

Nenhum domínio foi comprado, plano pago contratado ou integração de checkout real alterada nesta sessão.
