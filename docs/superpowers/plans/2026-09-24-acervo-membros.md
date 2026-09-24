# Acervo de materiais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ajudar alunos a encontrar, retomar e baixar materiais comprados rapidamente, com ajuda acessível e progresso persistente.

**Architecture:** Evoluir páginas existentes. Dados autorizados no servidor alimentam componentes pequenos, mantendo downloads pela rota /abrir. Retomada usa item_access; conclusão usa tabela própria.

**Tech Stack:** Next 16.3.5, React 19.2.8, TypeScript, Tailwind 4, Supabase, Vitest/PGlite e Vercel agent-browser 0.38.1.

**Spec:** docs/superpowers/specs/2026-09-24-acervo-membros-design.md

## Global Constraints
- Preservar identidade carvão/amarelo/laranja da Arquitetura e compatibilidade das demais lojas.
- Toda leitura e escrita de aluno deve validar sessão, loja, acesso atual ao produto e publicação de módulo/item; nunca confiar em customerId enviado pelo cliente.
- Nenhum dado, suporte, formato ou tamanho de arquivo será inventado; nenhum fetch remoto de arquivo será feito só para obter metadados.
- Não alterar e-mails, pagamentos, checkout, permissões de produção ou credenciais.
- Sem bypass de autenticação ou flags de teste nas rotas do produto. QA usa app real com provedor HTTP local fictício.
- Não publicar, aplicar migrações remotas ou fazer push nesta execução. Entregar implementação local completa, migração e instruções de ativação verificadas.
- Usar português claro e preservar fluxos de download autorizados existentes.

## Review Focus
1. Histórico com produto revogado ou item/módulo oculto não fornece atalho; Task 1 testa isso.
2. POST adulterado não marca item de outra loja/aluno/produto; Task 1 testa autorização.
3. Erro de persistência nunca exibe progresso salvo; Tasks 1 e 3 testam erro e retry.
4. URL sem extensão, codificação inválida ou query enganosa não gera formato falso; Task 2 testa metadados.
5. Busca vazia/sem resultados e títulos longos continuam navegáveis a 375px; Tasks 3 e 4 testam.

## Execução e propriedade
Tasks 1 e 2 independentes em paralelo; Task 3 após ambas. Task 4 após integração, fixture pode ser preparada antes. Todos trabalham no worktree explicitado pelo controlador. Commits somente arquivos próprios. Review de cada task e final independentes. User delegou revisão/aprovação: plano revisado pelo controlador antes de execução; não aguardar nova pergunta.

### Task 1: Dados autorizados de recentes e progresso
**Files:** Modify src/lib/data/item-access.ts; Create src/lib/data/member-progress.ts, src/app/[loja]/progresso/actions.ts, supabase/migrations/20260924000001_member_progress.sql; Test tests/membros/member-progress.test.ts, tests/membros/member-progress-action.test.ts, tests/membros/recent-materials.test.ts, tests/membros/member-progress-sql.test.ts.

**Interfaces:**
```ts
type RecentMaterial = { itemId: string; title: string; kind: ItemKind; productId: string; productTitle: string; productSlug: string }
listRecentMaterials(customerId: string, storeId: string, granted: Set<string>, productId?: string): Promise<RecentMaterial[]>
listCompletedItemIds(customerId: string, storeId: string, productId: string): Promise<string[]>
setItemCompletion(entry: {customerId:string;storeId:string;productId:string;itemId:string;completed:boolean}): Promise<void>
type CompletionResult = {ok:true;completed:boolean} | {ok:false;error:string}
saveCompletion(storeSlug:string,itemId:string,completed:boolean): Promise<CompletionResult>
```
Export RecentMaterial from item-access.ts and CompletionResult from action. Keep old exports for compatibility. listRecentMaterials uses bounded relational query, deduplicates item id in recency order, filters granted + actual item/module/product publication, kind destination validity, store match, and optional product. No N+1. No exceptions silently converted to success.

- [x] Write red tests for revoked/unpublished/invalid/cross-store recents and authorized completion with changed/revoked session. Pattern:
```ts
expect(await saveCompletion('outra-loja', itemId, true)).toMatchObject({ok:false})
expect(writeMock).not.toHaveBeenCalled()
```
- [x] Run focused tests with npm test -- tests/membros/member-progress-action.test.ts tests/membros/recent-materials.test.ts and record RED.
- [x] Implement migration: composite PK customer_id/store_id/item_id, FKs to customers/stores/products/items, completed boolean or completed-only rows, timestamps, product index, RLS enabled and no public policy. Use upsert/delete for completion. Test schema in PGlite following existing SQL tests.
- [x] Action validates arguments, calls requireStoreSession, getItemWithContext, validates publication/store/destination and loadGrantedProductIds BEFORE write. Derive customer only from session. Catch operational errors with actionable Portuguese message; preserve Next redirect semantics; revalidate relevant product/item/home paths.
- [x] Run focused tests plus lint owned files, self-review and commit only owned files. Report commands/output, RED/GREEN, migration activation limitation to task-1-report.md.

### Task 2: Arquivos compreensíveis e ajuda contextual
**Files:** Create src/lib/content/resource-label.ts, src/components/membros/material-help.tsx; Modify src/components/membros/resource-list.tsx, src/components/membros/store-header.tsx, src/components/membros/locked-poster.tsx, src/app/[loja]/entrar/page.tsx, src/app/[loja]/entrar/form.tsx; Test tests/membros/resource-label.test.ts, tests/membros/material-help.test.ts, tests/membros/resources.test.ts and targeted login/locked tests.

**Interfaces:**
```ts
resourceLabel(item: Pick<Item,'kind'|'url'>): {typeLabel:string;actionLabel:string}
MaterialHelp({href,context}: {href:string|null;context?:'login'|'material'}): React.JSX.Element
```
Helper uses URL pathname + guarded decodeURIComponent, recognized extension allowlist PDF, ZIP, DWG, SKP, XLSX, DOCX, PPTX, PNG/JPG etc; ignore query/fragment, no claimed size. MaterialHelp native details with actionable instructions always available. Only safe HTTP(S) href produces contact anchor; label Precisa de ajuda?. Material context includes Downloads and external tool troubleshooting. Unknown support directs to contact in purchase receipt, never invents number.

- [x] Write tests before behavior code. Example:
```ts
expect(resourceLabel({kind:'arquivo',url:'https://example.test/file?name=fake.pdf'})).toEqual({typeLabel:'Arquivo',actionLabel:'Baixar arquivo'})
expect(resourceLabel({kind:'arquivo',url:'https://example.test/guia.pdf'}).actionLabel).toBe('Baixar PDF')
```
- [x] Run focused test RED; implement helper and visible textual download actions preserving /abrir and accessible names. No changes to resource authorization.
- [x] Add help to login, connect errors to email via aria-invalid/describedby, preserve pending and entered email. Header Conta min-h-11, semantic active home state via optional prop if needed, expose useful materials navigation on mobile without crowding.
- [x] Locked modal no checkout: explain unavailable purchase path, optional safe help if interface can accept it without editing page callers owned by Task 3.
- [x] Run covering tests and lint own files; self-review/commit. Report task-2-report.md. Do not edit routes home/product/item, toolbar/sidebar or architecture.css (Task 3 owns).

### Task 3: Integrar biblioteca, retomada e navegação responsiva
**Files:** Modify src/app/[loja]/page.tsx, src/app/[loja]/produto/[slug]/page.tsx, src/app/[loja]/item/[id]/page.tsx, src/app/[loja]/architecture.css, src/components/membros/lesson-toolbar.tsx, src/components/membros/lesson-sidebar.tsx; Create src/components/membros/material-library.tsx; Test tests/membros/material-library.test.ts, tests/membros/content-routes.test.ts, tests/membros/lesson-toolbar.test.ts, tests/membros/architecture-theme.test.ts.

**Consumes:** Task 1 interfaces exactly; MaterialHelp and resourceLabel Task 2. **Produces:** complete member UI; no API signature changes without controller notice.

- [x] Read Next installed guide for server/client components, caching and server actions; read original impeccable/reference/craft-floor.md immediately before UI edits. Preserve incumbent world.
- [x] Write failing tests: home never mixes locked in Meus materiais, recent href resolves authorized /abrir for downloads and item page for video, product resumes valid recent item, sidebar not duplicated on product, completion failure retains prior state and error.
```ts
expect(html).toContain('Meus materiais')
expect(html).toContain('Acessados recentemente')
expect(recentHref).toBe('/arquitetura/item/' + itemId + '/abrir')
```
- [x] Build compact header/welcome in place of always-large hero. Keep supplied artwork as compact visual identity if useful. Render acquired collection grid with category labels, optional client search for multiple products, safe empty/no-results states and reset; offers separate Conheça outros produtos. Recent section only when nonempty.
- [x] Product: single module list, no duplicate sidebar. Primary action Retomar material when valid history exists, otherwise Abrir primeiro material; resources near the top within modules and videos clearly named. Provide MaterialHelp for empty content and normal page.
- [x] Item: load completion IDs after authorization; keep recording only existing video access behavior and /abrir download behavior. Sidebar before main content in mobile flow using responsive CSS order, native disclosure on small screens, visible sidebar on desktop. Mark completed items and current item with text/semantics. Avoid multiple duplicate IDs across responsive versions.
- [x] Toolbar: consume server completed state and saveCompletion, use pending/error feedback, reversible completion and router refresh to sync sidebar. Replace aula labels with conteúdo. Remove localStorage success claim, show saved state only after server success, no fake progress on failure. Preserve Escape/focus on Sobre; do not label product description as item description.
- [x] Handle recent/progress read failure gracefully with explicit useful notice; keep primary downloads available. No blanket silent catch. Feature DB migration remains required for synchronization.
- [x] Tests include accents/case-insensitive search, empty collections, long titles, completion failure and repeat submission; update preexisting assertions only for intentional behavior changes. Run focused tests, full suite once integration stable, lint/build. Self-review and commit own files; report task-3-report.md.

### Task 4: QA hidratado com agent-browser e entrega
**Files:** Create scripts/qa-members-browser-fixture.mjs, docs/qa/acervo-membros/browser-report.md, docs/qa/acervo-membros/activation.md and screenshots there. Use existing admin fixture as reference, avoid duplicating application logic.

**Interfaces:** Local fake Supabase HTTP provider only; app remains unchanged. Expose minimal auth/rest responses matching actual app requests. Use test-only data and fixed synthetic IDs; support completion writes/read, two products acquired, one locked, multiple modules and formats. No real secrets.

- [x] Start fixture bound 127.0.0.1, Next real app with fake env in a hidden/background process; record PIDs and stop method. Login through UI to fictional account.
- [x] Run agent-browser 0.38.1 explicit executable from npm cache. Desktop 1440x900, mobile 375x812. Exercise search/no results/clear, recent item, product, file route, modules, completion reload, help, keyboard, locked no checkout and zero-material account scenario where feasible.
- [x] Capture screenshots with real hydrated components and read them. Check document overflow, named controls, errors/console. Distinguish local fixture integration from remote database/email validation.
- [x] Test migration in PGlite with real schema assertions, npm test, npm run lint, npm run build. Do not rerun unchanged full suite when Task 3 already supplies exact final code evidence; focused new QA is sufficient.
- [x] Document migration-before-deploy activation and manual production smoke test, no remote deployment. Stop own servers/browser session. Commit QA artifacts and final report; controller independent review then copy only scoped changed files back to original checkout after checking no concurrent edits to those files.
