# Revisão do login administrativo no navegador

Ambiente local: Next.js 16.3.5 em `http://127.0.0.1:3310`, fixture Supabase em `http://127.0.0.1:3311`, Chrome controlado por `npx --yes agent-browser@0.38.1 --session admin-browser-review`. Dados fictícios: `admin@example.test`, código de teste `123456`. O fixture não envia e-mail nem acessa banco externo.

| Cenário | Resultado observado |
| --- | --- |
| Desktop 1440×900 e celular 390×844 | Campos com nomes acessíveis, checkbox inicialmente desmarcado; sem overflow horizontal (`scrollWidth` igual à largura da viewport). |
| Escolha explícita | Marcar, desmarcar e remarcar funcionam. Após código inválido e reenvio, permanece marcada. |
| Código inválido | Mensagem `Código inválido ou expirado.` visível, foco permanece no fluxo de código. |
| Código válido, escolha marcada | Redireciona a `/admin/sucesso`; cookie HTTP-only `admin-browser-session` observado com prazo restante de 604796 segundos logo após autenticação. |
| Código válido, escolha desmarcada | Redireciona a `/admin/sucesso`; cookie HTTP-only `admin-browser-session` observado com `expires=-1` (cookie de sessão no Chrome). |
| Retorno e recarga | Abrir `/admin/entrar` com confirmação válida redireciona ao painel, que permanece acessível após recarga, sem novo código. |
| Saída | Botão `Sair` remove o marcador; o login reaparece. |
| Cookie adulterado | Substituir o marcador por `tampered` e abrir `/admin/sucesso` redireciona a `/admin/entrar`. |
| Prazo absoluto | Marcador com assinatura válida, emitido 604800001 ms antes, rejeitado mesmo com sessão Supabase recém-autenticada e cookie do navegador ainda vigente; painel redireciona ao login. |

Screenshots: [desktop e-mail](desktop-email.png), [desktop código](desktop-code.png), [desktop código inválido](desktop-invalid-code.png), [desktop autenticado](desktop-authenticated.png), [celular e-mail](mobile-email.png), [celular código](mobile-code.png), [celular código inválido](mobile-invalid-code.png).

Auditoria `agent-browser a11y --json` na tela de código inválido em desktop e celular: 0 violações após o ajuste local de contraste. Após limpar o histórico do console e repetir o fluxo final de e-mail, código inválido e login válido, `agent-browser console` e `agent-browser errors` não retornaram erros. Houve um erro anterior em `/admin/produtos` quando o teste clicou por engano em `Trocar`; o fixture contém apenas as respostas de banco necessárias para `/admin/sucesso`, então essa página fora do escopo não carrega. O erro não ocorreu no fluxo final.

O fixture responde `/auth/v1/otp`, `/verify`, `/user`, `/token` e `/logout`, emite JWT HS256 local e fornece uma loja vazia e contagens vazias ao painel. Ele valida a integração Next/Supabase cliente-servidor sem reproduzir entrega de e-mail, políticas reais do provedor, revogação remota ou restauração de cookies pelo navegador após fechamento. Os testes de contrato do backend cobrem identidade, renovação, revogação e assinatura em nível de função.

Comandos principais: `npm test -- tests/auth/admin-login-form.test.ts tests/auth/admin-login-interaction.test.ts` (2/2 arquivos verdes), `npx eslint src/app/admin/entrar/form.tsx tests/auth/admin-login-form.test.ts tests/auth/admin-login-interaction.test.ts scripts/qa-admin-browser-fixture.mjs` (sem diagnósticos), `git diff --check` (sem erros). O warning de configuração Vite exibido no teste já existia antes deste trabalho.
