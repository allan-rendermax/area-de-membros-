# Atlas e Protocolo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Exibir Atlas e Protocolo juntos no início da vitrine e oferecer acesso ou compra do complemento dentro do Atlas conforme os direitos reais.

**Architecture:** Um vínculo editorial opcional no produto, configurável e limitado à mesma loja, alimenta ordenação da vitrine e resolução de links no servidor. Duas tarefas de implementação sequenciais com revisões; preparação de QA independente em paralelo. A base de acesso existente continua sendo a autoridade.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, Supabase/PostgreSQL, Vitest/PGlite e Vercel Agent Browser.

**Spec:** `docs/superpowers/specs/2026-10-21-atlas-protocolo-design.md`

## Global Constraints

- Preservar todas as regras atuais de compra, níveis Básico/Completo e proteção de downloads.
- A associação não concede acesso; usar direitos atuais calculados no servidor.
- Validar mesma loja, impedir autorreferência e ignorar alvos ausentes/não publicados na área do aluno.
- Quem possui o complemento acessa sua rota interna; quem não possui abre checkout HTTP(S) válido em nova aba com `noopener noreferrer`.
- Usar `studentCheckoutUrl` válido quando disponível, senão `checkoutUrl`; não fixar checkout no componente.
- Sem checkout válido, mostrar indisponibilidade sem link quebrado ou liberação de material.
- Prévia administrativa conserva `previa=1` e não representa compra real.
- Configuração reutilizável por admin e cadastrador; nenhuma regra geral baseada em slug do Atlas.
- Migrar apenas a associação editorial Atlas → Protocolo na loja arquitetura, usando slugs confirmados e sem alterar ofertas, pedidos ou concessões.
- Testar front-end com Vercel Agent Browser em ambiente local com dados sintéticos, sem compras ou mensagens reais.

## Review Focus

- Referência a outra loja ou ao próprio produto: rejeitar no banco e na escrita administrativa (Task 1).
- Reimportação de ficha antiga: preservar associação; remoção explícita aceita (Task 1).
- Complemento oculto/excluído, ciclo ou alvo compartilhado: não vazar dados nem duplicar capas (Task 2).
- Compra pendente/reembolsada versus outra compra válida: destino acompanha direitos atuais, não somente posse do Atlas (Task 2).
- Prévia, celular recolhido e link ausente: acesso coerente e cartão visível, sem checkout inseguro (Task 2 e QA).

## Arquivos e responsabilidades

- `src/lib/domain/types.ts`, `src/lib/data/products.ts`: contrato e leitura do campo.
- `supabase/migrations/20261021010000_product_complement.sql`: integridade e associação inicial específica.
- `src/lib/admin/forms.ts`, `src/lib/data/products-admin.ts`, telas de produtos: editar associação com validação.
- `scripts/lib/cadastro-plano.mjs`, `scripts/lib/cadastro-executor.mjs`: ficha reutilizável, preservação e preflight.
- `src/lib/access/product-complement.ts`: resolução pura de complemento e destino, usada em servidor e renderização.
- `src/lib/access/access.ts`: transportar associação em ShelfProduct e agrupar trilhas sem duplicatas.
- `src/lib/data/product-complement.ts`: ler complemento e direitos com escopo da loja, sem enviar materiais ao cliente sem autorização.
- `src/components/membros/product-complement.tsx`: cartão e oferta com destino resolvido.
- vitrine, conteúdo, lateral e página de produto vazio: integração.
- `docs/qa/atlas-protocolo/`: fixture, roteiro, capturas e relatório de aceitação.

### Task 1: Associação configurável e integridade

**Files:**
- Create: `supabase/migrations/20261021010000_product_complement.sql`
- Modify: `src/lib/domain/types.ts`, `src/lib/data/products.ts`, `src/lib/data/products-admin.ts`, `src/lib/admin/forms.ts`
- Modify: `src/app/admin/(painel)/produtos/product-form.tsx`, `src/app/admin/(painel)/produtos/[id]/page.tsx`
- Modify: `scripts/lib/cadastro-plano.mjs`, `scripts/lib/cadastro-executor.mjs`, `docs/como-cadastrar-produto.md`
- Test: `tests/admin/product-complement-sql.test.ts`, `tests/admin/product-complement.test.ts`, `tests/content/product-complement.test.ts`, `tests/cadastro/product-complement.test.mjs` (use `.ts` instead if required by existing Vitest patterns).

**Interfaces:**
- Produces optional `Product.complementaryProductId?: string | null`, mapped from optional `DbProduct.complementary_product_id` and included in `PRODUCT_COLUMNS`.
- Produces optional `ProductInput.complementaryProductId?: string | null` parsed from `complementary_product_id`.
- Produces optional ficha `complemento` slug or literal `nenhum`; absence means preserve existing association.

- [x] **Step 1: Write failing behavior tests.** Use existing fixtures for ProductInput, mocked Supabase chain and real PGlite SQL. Pin the following actual assertions in focused tests, adapting fixture names from adjacent tests:

```ts
expect(toProduct({ ...row, complementary_product_id: targetId }).complementaryProductId).toBe(targetId)
form.set('complementary_product_id', targetId)
expect(parseProductForm(form, storeId).complementaryProductId).toBe(targetId)
form.set('complementary_product_id', 'invalid')
expect(() => parseProductForm(form, storeId)).toThrow()
```

PGlite cases: valid same-store link succeeds; self-link fails; cross-store link fails; deleting target keeps source and nulls the link; seed affects only intended architecture pair and preserves an already chosen complement. Importer cases: valid slug resolves within store; unknown slug fails before upload/write; omitted field preserves; `nenhum` clears; self slug fails. Cover batch validation before the first mutation.

- [x] **Step 2: Run focused tests and record RED.**

```powershell
npx vitest run tests/admin/product-complement-sql.test.ts tests/admin/product-complement.test.ts tests/content/product-complement.test.ts tests/cadastro/product-complement.test.ts --maxWorkers=2
```

Expected failure: missing field/behavior, not unrelated fixture errors.

- [x] **Step 3: Implement additive contract, migration and admin.**

```ts
// Add to Product and ProductInput:
complementaryProductId?: string | null
// DB mapping:
complementaryProductId: row.complementary_product_id ?? null,
// DB write (omitted input is preserved for programmatic legacy callers):
...(input.complementaryProductId !== undefined
  ? { complementary_product_id: input.complementaryProductId }
  : {}),
```

Migration uses unique `(store_id,id)`, nullable uuid and FK `(store_id,complementary_product_id)` referencing `(store_id,id)` with `ON DELETE SET NULL (complementary_product_id)`, plus `CHECK (complementary_product_id IS DISTINCT FROM id)`. Named constraints must be unique and migration should be safe to execute once in chronological sequence. Validate PostgreSQL behavior with PGlite, including deleting source/store. Seed via joining stores/products on exact slugs from spec, only where association is null. No access/offer migrations.

Admin reads products for the authenticated selected store and passes candidates into ProductForm; dropdown label `Produto complementar`, first option `Nenhum`, excluding current product. Help: `Aparece ao lado deste produto e dentro dos conteúdos. A compra é independente.` Server validates selected target exists in the same store before updating. Maintain authenticated action and store scoping. Avoid overwriting optional links in older programmatic callers; admin explicit empty selection clears.

- [x] **Step 4: Implement importer and document.**

```js
// lerFicha allowed fields includes 'complemento'; validate SLUG or 'nenhum'.
...(fields.complemento !== undefined ? { complemento: fields.complemento } : {}),
// During preflight resolve against products in entry.store; require existing target.
// During writing, distinguish undefined (preserve) from null (explicit removal).
...(entry.complementaryProductId !== undefined
  ? { complementary_product_id: entry.complementaryProductId }
  : {}),
```

Document example `complemento: protocolo-anti-retrabalho`, same-store preexisting target requirement, omission preservation, `complemento: nenhum` removal, and independent purchase.

- [x] **Step 5: Run focused tests, typecheck and commit.**

```powershell
npx vitest run tests/admin tests/content tests/cadastro --maxWorkers=2
npx tsc --noEmit
git add src/lib/domain/types.ts src/lib/data/products.ts src/lib/data/products-admin.ts src/lib/admin/forms.ts 'src/app/admin/(painel)/produtos' scripts/lib/cadastro-plano.mjs scripts/lib/cadastro-executor.mjs docs/como-cadastrar-produto.md supabase/migrations/20261021010000_product_complement.sql tests
git commit -m 'feat: configure same-store complementary products'
```

Use exact existing importer test directory if named differently; record real commands/results. Do not commit unrelated test modifications. Write report with RED/GREEN evidence.

### Task 2: Vitrine, acesso interno e proteção por compra

**Files:**
- Create: `src/lib/access/product-complement.ts`, `src/lib/data/product-complement.ts`, `src/components/membros/product-complement.tsx`
- Modify: `src/lib/access/access.ts`, `src/components/membros/lesson-sidebar.tsx`, `src/components/membros/item-content.tsx`, `src/app/[loja]/page.tsx`, `src/app/[loja]/produto/[slug]/page.tsx`
- Remove/replace: `src/components/membros/pathology-upsell.tsx`; reuse its CSS in generic component or rename to `product-complement.module.css`.
- Test: `tests/access/product-complement.test.ts`, `tests/access/tracks.test.ts`, `tests/membros/product-complement.test.ts`, replace `tests/membros/pathology-upsell.test.ts`, `tests/content/product-complement-access.test.ts`.

**Interfaces:**
- Consumes `Product.complementaryProductId` from Task 1.
- Produces `resolveProductComplement(source: Product, products: Product[], granted: Set<string>, storeSlug: string, preview?: boolean): ProductComplement | null` with `ProductComplement = { product: Product; owned: boolean; href: string | null; external: boolean }`.
- Produces `loadProductComplement(source: Product, storeSlug: string, customer: CustomerRow | null, preview: boolean): Promise<ProductComplement | null>` using existing products/access data functions, short-circuiting when no association.
- Extends ShelfProduct with optional `complementaryProductId`; helpers for arranging existing tracks must be deterministic and nonrecursive.
- Component `ProductComplementCard({ complement })` for Contents; `ProductComplementOffer({ complement })` for body; optional preview and store slug may be included in resolved data rather than client lookups.

- [x] **Step 1: Write failing pure/data/render tests.**

```ts
const source = { ...atlas, complementaryProductId: protocol.id }
expect(resolveProductComplement(source, [atlas, protocol], new Set([protocol.id]), 'arquitetura')?.href)
  .toBe('/arquitetura/produto/protocolo-anti-retrabalho')
expect(resolveProductComplement(source, [atlas, protocol], new Set([atlas.id]), 'arquitetura')?.href)
  .toBe(protocol.checkoutUrl)
expect(resolveProductComplement(source, [{ ...protocol, storeId: 'other' }], new Set(), 'arquitetura'))
  .toBeNull()
expect(resolveProductComplement(source, [{ ...protocol, isPublished: false }], new Set(), 'arquitetura'))
  .toBeNull()
```

Cover checkout student priority/fallback, missing/unsafe URLs, unpublished/absent/self target, preview URL, and access from `grantedProductLevels` with pending/refunded/paid duplicate orders. DOM assertions: owned card and body link to material route and contain no sales copy; unowned link has target/rel; mobile card is outside collapsed details; basic/complete independent; product with no usable items still shows complement. Track tests cover unowned/owned combinations, first two IDs, no target duplicate, cycles/shared target and unchanged ordering without valid relation.

- [x] **Step 2: Run focused tests and record RED.**

```powershell
npx vitest run tests/access/product-complement.test.ts tests/membros/product-complement.test.ts tests/content/product-complement-access.test.ts --maxWorkers=2
```

- [x] **Step 3: Implement resolver and server loading.**

```ts
const target = products.find(p => p.id === source.complementaryProductId
  && p.id !== source.id && p.storeId === source.storeId && (preview || p.isPublished))
if (!target) return null
const owned = preview || granted.has(target.id)
const checkout = [target.studentCheckoutUrl, target.checkoutUrl].find(value => isHttpUrl(value ?? '')) ?? null
return { product: target, owned, href: owned
  ? withPreview(`/${storeSlug}/produto/${target.slug}`, preview) : checkout, external: !owned }
```

Use trusted storeSlug from authorized caller; only expose catalog metadata and resolved link, never item URLs. `loadProductComplement` uses `getProductById` then validates same store and publication and `loadGrantedProductIds` for a real customer; preview is only passed from authorized preview flow. Errors propagate rather than guessing ownership and offering repurchase.

- [x] **Step 4: Implement ordering and cards.**

Keep `buildTracks` original behavior unless visible linked pairs exist. In a separate pure helper (in product-complement.ts or a small focused file) process configured source/target pairs deterministically with a `Set` of already placed IDs, prepend pair to source's existing track, move that track first, remove target elsewhere, filter empty tracks. Preserve product unlock state and metadata. `buildShelf` copies the association field. Vitrine places first associated track before Continuar; other stores without links keep current ordering. Source and target occupy the first two positions.

Unowned complementary cover links directly to validated checkout with lock and explicit `Comprar` label; owned cover uses existing PosterLink/internal navigation. Ordinary unrelated locked products retain LockedPoster behavior. Shared checkout validation is reused, not copied. Keep `?comprar=` deep link behavior coherent.

Card uses existing dark surface, border, yellow accent and product title, with `Acessar materiais`/`Comprar Protocolo Anti-Retrabalho` (dynamic product title), or `Compra indisponível` without anchor. Body offer uses product description/title for nonbuyers and neutral `Seu produto está liberado` for owners. Remove hardcoded Atlas/checkout from generic runtime.

Add a `complement?: ReactNode` slot to LessonSidebar and render it inside the panel but outside the mobile-collapsible `details`, so it is always visible. Do not put the complementary product into module sequence, completed IDs or upgrade card. Load same complement once in renderItemContent and feed both surfaces. Empty-content product page renders card as well. Preserve help, support, terms, WhatsApp and preview flows.

- [x] **Step 5: Run integration suite and commit.**

```powershell
npx vitest run tests/access tests/membros tests/content --maxWorkers=2
npx tsc --noEmit
git add src/lib/access src/lib/data/product-complement.ts src/components/membros 'src/app/[loja]/page.tsx' 'src/app/[loja]/produto/[slug]/page.tsx' tests/access tests/membros tests/content
git commit -m 'feat: surface complementary products with ownership-aware navigation'
```

### Task 3: Browser acceptance and delivery verification

**Files:**
- Create: `docs/qa/atlas-protocolo/browser-fixture.mjs`, `docs/qa/atlas-protocolo/validation.md`, screenshots in same directory.

**Interfaces:**
- Uses `createCommunityFixture` from existing QA, actual Next pages and synthetic Supabase; no real .env, payments or mail.
- Produces reproducible local QA command and observed buyer/nonbuyer results.

- [x] **Step 1: Prepare fixture.** Extend community fixture with Atlas relation, Protocolo record/modules and two Atlas-owning accounts; only one owns Protocolo. Use synthetic local checkout `/reference`, isolate ports, run Next with `--webpack` if node_modules junction requires it. Add third blocked/invalid target scenarios to fixture data as necessary; ensure acceptance does not mock the React component under test.

```js
const fixture = createCommunityFixture()
const atlas = fixture.tables.products.find(p => p.id === id(10))
atlas.complementary_product_id = id(81)
// Add id(81) product in same store, own module/items and QA-PROTOCOLO paid offer.
// Existing aluno@example.test is Atlas-only; protocolo@example.test has both.
```

- [x] **Step 2: Run Vercel Agent Browser.**

```powershell
node docs/qa/atlas-protocolo/browser-fixture.mjs
npx --yes agent-browser@0.38.1 --session atlas-protocolo --allowed-domains 127.0.0.1,localhost open http://127.0.0.1:3350/arquitetura/entrar
npx --yes agent-browser@0.38.1 --session atlas-protocolo snapshot -i
npx --yes agent-browser@0.38.1 --session atlas-protocolo set viewport 390 844
npx --yes agent-browser@0.38.1 --session atlas-protocolo screenshot docs/qa/atlas-protocolo/mobile.png
```

Use observed refs to login, inspect first carousel IDs/order, click bought cover to materials; verify unowned cover/card links to local checkout, not a modal. Inspect Atlas in both levels, desktop 1440x1000 and mobile 390x844; collapsed Contents still has card. Check no overflow (`scrollWidth <= innerWidth`), console/errors and screenshot actual page. Save actual commands/outcomes in report, distinguishing synthetic purchase state from real payment integration.

- [x] **Step 3: Run final project checks, review and preserve deliverables.**

```powershell
npx vitest run --maxWorkers=2
npx tsc --noEmit
npm run lint
npm run build -- --webpack
```

Use isolated fictitious env for build when required. Baseline default 124-worker run timed out 13 PGlite tests; rerun with maxWorkers=2 to control contention rather than relaxing assertions. Record preexisting warnings separately. Final reviewer examines feature diff from snapshot baseline, all task reports and QA report. Deliver scoped feature files back to original workspace only after confirming they still match baseline, preserving unrelated changes. No publish/push implied; report migration/deploy pending if not performed.

## Self-review

All acceptance criteria map to Tasks 1–3. Cross-task contract is `complementaryProductId`, used consistently. No access grant or checkout-price heuristic introduced. Five review-focus risks have explicit tests in their owning task. User selected subagent execution and autonomous plan review, so proceed without another approval prompt.
