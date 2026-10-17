# E-mail transacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o e-mail de acesso mais direto, preservando a marca e o link do grupo.

**Architecture:** Alteração de conteúdo e hierarquia visual no template HTML existente. Transporte, dados e regras de envio permanecem compatíveis; a classificação do Gmail é observada, não controlada.

**Tech Stack:** TypeScript, Vitest, Next.js 16.3.5, Resend, agent-browser.

**Spec:** docs/superpowers/specs/2026-10-17-email-transacional-design.md

## Global Constraints

- Preservar cabeçalho escuro, detalhe laranja e botão amarelo na Arquitetura; preservar o tema das demais lojas.
- Títulos: acesso_novo = "Seu acesso está disponível."; produto_novo = "Novos materiais disponíveis."; reenvio = "Seu link de acesso.".
- Título em 28px no desktop e 24px no celular, sem quebra de linha forçada.
- Manter o link do WhatsApp no e-mail, após as instruções: prefixo "Grupo do projeto: " e link "Entrar no grupo do WhatsApp", verde escuro #127443, sublinhado. Sem fundo colorido de botão ou formato pill no e-mail.
- Preservar assunto, remetente, destinatário, URL de acesso e fallback, produtos, explicação de login sem senha e motivo transacional do rodapé.
- Preservar validação/escape de URLs e omissão do bloco quando não houver grupo válido.
- Não alterar a área de membros, banco, DNS, tracking, regras de acesso ou dependências.
- Não prometer a aba Principal nem alterar categorias no Gmail durante a validação.

## Review Focus

O comportamento sensível já possui testes: três tipos de mensagem, ausência/URL inválida do grupo, escape de títulos/URLs, tema de outra loja e ausência de nome/produtos. Executar esses testes; não criar testes de strings CSS que apenas copiem a implementação. A revisão visual cobre hierarquia, contraste e quebra de texto em 375px e 1440px. Não existe teste determinístico de classificação do Gmail.

### Task 1: Ajuste limitado do template

**Files:**
- Modify: src/lib/email/access-template.ts
- Validate, sem alteração esperada: tests/email/access-template.test.ts e tests/email/
- Artefatos sintéticos não versionados: .superpowers/sdd/2026-10-17-email-transacional/previews/

**Interfaces:**
- Consumes: AccessNotice e getCommunityWhatsappUrl, já existentes.
- Produces: accessNoticeEmail(notice: AccessNotice, loginUrl: string): { subject: string; html: string }, sem alteração de assinatura.

- [ ] **Step 1: Baseline e instruções locais**

Ler AGENTS.md e o guia Next pertinente existente em node_modules/next/dist/docs (usar rg --files para localizar). Executar `npx vitest run tests/email --maxWorkers=2` antes da edição e registrar o resultado.

- [ ] **Step 2: Aplicar as substituições**

Usar os títulos exatos das Global Constraints nos três campos heading de COPY. Trocar `.title{font-size:32px!important}` por `.title{font-size:24px!important}`. No h1, usar `font-size:28px;line-height:1.25;letter-spacing:-.5px` mantendo margem e peso existentes. Substituir apenas a definição do bloco community por:

```ts
const community = communityUrl ? `<tr><td class="pad" style="padding:24px 42px 0"><p style="margin:0;font-size:14px;line-height:1.7;color:${theme.body}">Grupo do projeto: <a href="${escapeHtml(communityUrl)}" target="_blank" rel="noopener noreferrer" style="color:#127443;text-decoration:underline;text-underline-offset:3px">Entrar no grupo do WhatsApp</a></p></td></tr>` : ''
```

Não editar outras linhas de lógica, estilo ou cópia. As mudanças são visuais e reversíveis; os testes existentes já cobrem os contratos funcionais.

- [ ] **Step 3: Validar e gerar previews**

Executar `npx vitest run tests/email --maxWorkers=2` e `npx eslint src/lib/email/access-template.ts`. Gerar HTML das três variantes usando accessNoticeEmail com nome "Ana Silva", endereço "ana@example.com", loja Arquitetura, produto "Atlas Visual das Patologias na Construção Civil" e URL `https://members.grupoelevamax.com/arquitetura/entrar?email=ana%40example.com`. Para o grupo usar `https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t`. Guardar somente na pasta sintética de previews. O controlador fará a inspeção visual e o build em paralelo à revisão.

- [ ] **Step 4: Self-review e commit**

Inspecionar `git diff --check` e o diff. Commitar somente src/lib/email/access-template.ts com mensagem `fix: simplify transactional access email hierarchy`. Escrever relatório no caminho fornecido pelo controlador com comandos, resultados, arquivos e ressalva de que isto não comprova mudança de categoria.

## Integração pelo controlador

- [ ] Revisão da tarefa e revisão final com pacotes de diff, sem refazer testes já registrados.
- [ ] agent-browser: desktop/mobile das três variantes, href exato, um único botão principal, ausência de overflow, contraste do link e console.
- [ ] `npm run build`; publicar por fast-forward se origin/main ainda for a base validada.
- [ ] Conferir o SHA do deploy Ready; enviar um único teste ao próprio usuário pelo fluxo de reenvio; verificar autenticação, conteúdo HTML/texto e categoria efetiva no Gmail.
- [ ] Registrar resultado honesto e preservar evidências privadas fora do repositório público.
