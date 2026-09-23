# Revisão: confiar no navegador por sete dias

## Escopo e decisões

Revisão autônoma solicitada pelo usuário, planejada em `docs/superpowers/plans/2026-09-23-admin-browser-review.md`. Trabalho realizado em `codex/admin-browser-review`, com revisão de servidor e teste de frontend em paralelo. O prazo aprovado continua sendo sete dias absolutos; a opção começa desmarcada. Não houve publicação nem alteração de dados reais.

Sessões administrativas anteriores sem o marcador de confirmação precisam validar um novo código uma vez. Sem marcar a opção, o marcador é cookie de sessão; navegadores que restauram sessões podem preservá-lo. O prazo máximo no servidor continua sendo sete dias. A renovação automática dos tokens não prorroga esse prazo.

## Revisão do servidor

Uma resposta incompleta de `verifyOtp`, sem erro mas sem nova sessão, podia levar a ação a consultar a sessão antiga e emitir uma nova confiança. A ação agora exige usuário e token retornados pela confirmação e valida os claims daquele token, incluindo a correspondência do usuário. As duas regressões foram reproduzidas antes da correção.

O cookie continua assinado, vinculado ao usuário e à sessão, `HttpOnly`, `SameSite=Lax` e `Secure` em produção. A autorização mantém a consulta ao usuário no provedor e à lista de administradores. Expiração, assinatura, identidade, sessão, segredo e dados malformados têm cobertura automatizada.

Revisão independente da alteração de servidor: aprovada, sem achados acionáveis. A base isolada passou em 408 testes; a entrega do servidor passou em 38 testes focados e lint dos seus arquivos.

## Limite dos testes externos

A integração no navegador usa a aplicação Next real e um provedor HTTP local com dados fictícios. Isso exercita as Server Actions, os cookies, os redirecionamentos e a interface sem enviar e-mails. Não valida a entrega de e-mail, configurações remotas do Supabase nem persistência em todos os navegadores do usuário.

## Resultado integrado

- `npm test`: 55 arquivos e 425 testes aprovados.
- `npm run lint`: zero erros; permanece um aviso anterior de variável `loja` não utilizada em `scripts/trocar-admin-e-aluno.mjs`.
- `npm run build`: compilação, TypeScript e geração de páginas concluídos.
- Teste com agent-browser 0.38.1 em Chrome: desktop 1440×900 e celular 390×844, conforme [relatório de navegador](browser-report.md).
- Correção adicional confirmada em React real e no navegador: escolha do checkbox preservada após erro e reenvio. Rótulos explícitos e contraste local melhorados; nenhum bypass de teste foi adicionado ao produto.

## Reproduzir o ambiente isolado

Em um terminal na pasta do projeto, iniciar o provedor fictício:

```powershell
node scripts/qa-admin-browser-fixture.mjs
```

Em outro terminal, usar estas variáveis apenas nesse processo para iniciar a aplicação sem credenciais reais:

```powershell
$env:SUPABASE_URL='http://127.0.0.1:3311'
$env:SUPABASE_PUBLISHABLE_KEY='fixture-publishable-key'
$env:SUPABASE_SECRET_KEY='fixture-service-key'
$env:APP_URL='http://127.0.0.1:3310'
$env:ADMIN_EMAILS='admin@example.test'
$env:DEFAULT_STORE_SLUG='teste'
$env:LOGIN_GUARD_SECRET='fixture-only-hmac-secret-32-chars-minimum'
$env:PAYT_INTEGRATION_KEY='fixture-payt'
$env:RESEND_API_KEY='re_fixture'
$env:EMAIL_FROM='fixture@example.test'
npm run dev -- --hostname 127.0.0.1 --port 3310
```

Controlar um navegador dedicado em um terceiro terminal:

```powershell
npx --yes agent-browser@0.38.1 --session admin-browser-review open http://127.0.0.1:3310/admin/entrar
npx --yes agent-browser@0.38.1 --session admin-browser-review snapshot
```

Usar `admin@example.test` e código `123456`; outros códigos são recusados pelo fixture. Os identificadores da árvore acessível variam por etapa: tirar um novo snapshot antes de agir. Para produzir o marcador local de expiração, executar `node scripts/qa-admin-browser-fixture.mjs --expired-token`; ele serve apenas ao ambiente fictício. Encerrar o navegador dedicado com `npx --yes agent-browser@0.38.1 --session admin-browser-review close` e os dois processos de teste com Ctrl+C.

## Encerramento

Revisões independentes de servidor, interface e integração final aprovadas, sem pendências. O roteiro de reprodução foi corrigido para usar o mesmo segredo do gerador; o helper de produção aceitou o marcador 1 ms antes da expiração e o rejeitou no limite exato. Os 23 arquivos do escopo foram devolvidos à pasta original após conferência dos hashes. Nessa pasta, a suíte voltou a passar com 425 testes e o build de produção concluiu com sucesso. Os processos de QA foram encerrados. A branch local `codex/admin-browser-review` preserva os commits; não houve push nem deploy. A pasta temporária de revisão foi preservada porque sua limpeza foi bloqueada pela política do executor.
