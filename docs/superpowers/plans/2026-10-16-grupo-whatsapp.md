# Grupo WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Entregar o convite do grupo por e-mail e nas páginas de conteúdo, com configuração por loja.

**Architecture:** Uma URL opcional da loja alimenta tanto AccessNotice quanto um componente de convite reutilizável. A migration habilita Arquitetura, o admin permite editar/desativar e os consumidores omitem links ausentes ou inválidos. As regras de compra e sessão permanecem existentes.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, Supabase/PostgreSQL, Vitest/PGlite, CSS Modules, Vercel agent-browser.

**Spec:** `docs/superpowers/specs/2026-10-16-grupo-whatsapp-design.md`

## Global Constraints
- Convite inicial exclusivo da loja com slug `arquitetura`: `https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t`.
- Campo opcional `community_whatsapp_url` no banco e `communityWhatsappUrl` no domínio; configurável no admin de lojas. Limpar o campo desativa o convite. Outras lojas começam sem grupo e podem configurar o próprio.
- Aceitar somente HTTPS, host exato `chat.whatsapp.com`, sem credenciais/porta customizada/fragmento, e um único segmento de convite alfanumérico, hífen ou underscore. Preservar query string válida, inclusive `?mode=gi_t`; valores inválidos nunca viram links.
- E-mails `acesso_novo`, `produto_novo` e `reenvio` mostram convite secundário; o botão principal continua “Acessar meus materiais”. Não disparar envio retroativo nem e-mail real durante QA.
- Preservar rodapé ElevaMAX, upsell existente e WhatsApp individual de suporte. Respeitar autenticação e autorização atuais.
- Sem novas dependências do produto. Ler os guias locais do Next 16.3.5 antes de alterar componentes.

## Review Focus
1. Loja sem configuração ou outro slug: nunca recebe por fallback o grupo de Arquitetura; Task 1 e Task 3 testam isolamento.
2. URLs manipuladas/host parecido/credenciais: nunca viram href; Task 1 e consumidores Tasks 2/3 testam rejeição.
3. Reenvio e compra automática: preservam campo no StoreRef, inclusive null; Tasks 1/2 testam consultas e envio.
4. Produto sem itens e navegação direta: convite aparece uma vez só e nunca antes do login; Task 3 cobre integrações e QA.
5. Tela de 375px/teclado/e-mail: CTA legível, sem overflow, principal de e-mail preservado; Tasks 2/3 geram prévia e QA.

---

### Task 1: Configuração por loja e propagação dos dados

**Files:**
- Create: `src/lib/community/whatsapp.ts`
- Create: `supabase/migrations/20261016010000_store_community_whatsapp.sql`
- Modify: `src/lib/domain/types.ts`, `src/lib/data/stores.ts`, `src/lib/data/products.ts`, `src/lib/admin/forms.ts`, `src/app/admin/(painel)/lojas/store-form.tsx`, `src/lib/email/server.ts`
- Test: `tests/community/whatsapp.test.ts`, `tests/admin/store-community-sql.test.ts`, `tests/content/store-community.test.ts`, `tests/admin/forms.test.ts`, `tests/content/store-cache.test.ts`, `tests/email/server-community.test.ts`

**Interfaces:**
- Consumes: `Store`, `StoreRef`, `StoreInput`, `parseStoreForm`, `toStore`, `saveStore`, `findStoreForProductCode`, `prepareResend` through public resend functions.
- Produces: `communityWhatsappUrl?: string | null` on Store and StoreRef (optional for existing fixtures), `communityWhatsappUrl: string | null` on StoreInput, `getCommunityWhatsappUrl(value: unknown): string | null`.

- [x] **Step 1: Add behavioral tests before production changes**
```ts
import { describe, expect, it } from 'vitest'
import { getCommunityWhatsappUrl } from '@/lib/community/whatsapp'
const invite = 'https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t'
describe('community invitation', () => {
  it('preserves the invitation and query', () => {
    expect(getCommunityWhatsappUrl(` ${invite} `)).toBe(invite)
  })
  it.each([null, undefined, '', 'javascript:alert(1)', 'http://chat.whatsapp.com/abc', 'https://chat.whatsapp.com.evil.test/abc', 'https://user@chat.whatsapp.com/abc', 'https://chat.whatsapp.com:444/abc', 'https://chat.whatsapp.com/', 'https://chat.whatsapp.com/a/b', 'https://chat.whatsapp.com/abc#x'])('omits invalid invitation %s', value => {
    expect(getCommunityWhatsappUrl(value)).toBeNull()
  })
})
```
Extend existing FormData tests with `community_whatsapp_url`: exact invite accepted, whitespace/empty -> null, malformed host throws FormError. Use mocked Supabase HTTP as in store-cache tests to assert select contains new column, mapping returns independent values for two stores and saveStore persists value/null. Test findStoreForProductCode nested `stores` mapping, missing store -> null and error propagation. In server-community tests mock transport/log/store/customer/access and call public resend function to capture populated notice for configured and unconfigured stores. In PGlite create minimal stores(id text,slug text), insert architecture/other, run migration twice, assert architecture invite/other null, then set a different invite and reapply to ensure preservation.

- [x] **Step 2: Run focused tests and record failing assertions**
Run `npx vitest run tests/community/whatsapp.test.ts tests/admin/store-community-sql.test.ts tests/content/store-community.test.ts tests/email/server-community.test.ts tests/admin/forms.test.ts tests/content/store-cache.test.ts`.

- [x] **Step 3: Implement the shared configuration**
```ts
export function getCommunityWhatsappUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const candidate = value.trim()
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' || url.hostname !== 'chat.whatsapp.com' || url.username || url.password || url.port || url.hash || !/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return null
    return candidate
  } catch { return null }
}
```
```sql
alter table public.stores add column if not exists community_whatsapp_url text;
update public.stores
set community_whatsapp_url = 'https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t'
where slug = 'arquitetura' and community_whatsapp_url is null;
```
Add optional domain field and include it in StoreRef's Pick. Add column to STORE_COLUMNS and DbStore, map with `row.community_whatsapp_url ?? null`, persist in saveStore. Parse form with shared validator, throwing `FormError('Link do grupo inválido. Use um convite https://chat.whatsapp.com/...')` for nonempty invalid input. Add label/input after support fields:
```tsx
<label className={ui.label}>
  Grupo do WhatsApp (opcional)
  <input name="community_whatsapp_url" type="url" defaultValue={store?.communityWhatsappUrl ?? ''} placeholder="https://chat.whatsapp.com/..." className={ui.input} />
  <span className="text-sm text-texto-suave">Convite exibido nos e-mails de acesso e nas aulas. Deixe vazio para ocultar.</span>
</label>
```
For findStoreForProductCode select `stores(id, slug, name, community_whatsapp_url)` and explicitly return `{id,slug,name,communityWhatsappUrl: row.community_whatsapp_url ?? null}` instead of casting raw row as StoreRef. Include `communityWhatsappUrl: store.communityWhatsappUrl ?? null` in prepareResend's store object. Preserve current auth/Payt/access semantics.

- [x] **Step 4: Run the focused suite and type check**
Run the command from Step 2 plus `npx tsc --noEmit`; generated Next route types may require `npx next typegen` first. Adjust existing expected store objects for the new null property only.

- [x] **Step 5: Commit scoped files**
Commit as `feat: configure WhatsApp community per store`; report tests and exact commit. No unrelated files or subagents.

### Task 2: Convite secundário no e-mail de acesso

**Files:**
- Modify: `src/lib/email/access-template.ts`, `tests/email/access-template.test.ts`, `tests/email/notifier.test.ts`

**Interfaces:**
- Consumes: `notice.store.communityWhatsappUrl`, `getCommunityWhatsappUrl(value: unknown): string | null`.
- Produces: Same `accessNoticeEmail(notice, loginUrl): { subject: string; html: string }`, with optional secondary community row.

- [x] **Step 1: Add conditional invitation tests**
Use existing notice fixture and tests; add:
```ts
it.each(['acesso_novo', 'produto_novo', 'reenvio'] as const)('includes a secondary invitation for %s', kind => {
  const group = 'https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t'
  const email = accessNoticeEmail({ ...notice, kind, store: { ...notice.store, communityWhatsappUrl: group } }, url)
  expect(email.html).toContain(`href="${group}"`)
  expect(email.html).toContain('Entrar no grupo do WhatsApp')
  expect(email.html.indexOf('Acessar meus materiais')).toBeLessThan(email.html.indexOf('Entrar no grupo do WhatsApp'))
})
```
Add missing/null/invalid URL cases that omit group label while retaining two login links; URL `https://chat.whatsapp.com/Example?mode=gi_t&source=%22test%22` must HTML-escape ampersand. In notifier use fake transport to assert outgoing HTML contains configured group and preserves login link/recipient for a configured store; no real mail.

- [x] **Step 2: Run tests and record red**
Run `npx vitest run tests/email/access-template.test.ts tests/email/notifier.test.ts`.

- [x] **Step 3: Render a mail-compatible row before the closing reminder row**
```ts
const communityUrl = getCommunityWhatsappUrl(notice.store.communityWhatsappUrl)
const community = communityUrl ? `<tr><td class="pad" align="center" style="padding:26px 42px 4px"><p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${theme.body}">Participe também do nosso grupo no WhatsApp.</p><a href="${escapeHtml(communityUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;max-width:100%;box-sizing:border-box;padding:14px 22px;border-radius:999px;background:#25d366;color:#102b1a;text-align:center;text-decoration:none;font-size:14px;font-weight:bold;line-height:1.5">Entrar no grupo do WhatsApp</a></td></tr>` : ''
```
Insert `${community}` after login instructions and before the final reminder. Keep existing typography and layout, no external image dependency for mail. Shared validator rechecks data from database.

- [x] **Step 4: Run all email tests**
Run `npx vitest run tests/email`; preserve no-group tests without loosening assertions.

- [x] **Step 5: Commit**
Commit as `feat: include community invitation in access emails`; report focused evidence. Controller renders actual generated HTML preview during browser QA.

### Task 3: Pill nas aulas e verificação visual

**Files:**
- Create: `src/components/membros/community-whatsapp.tsx`, `src/components/membros/community-whatsapp.module.css`, `tests/membros/community-whatsapp.test.ts`
- Modify: `src/components/membros/item-content.tsx`, `src/app/[loja]/produto/[slug]/page.tsx`
- Create: `docs/qa/grupo-whatsapp/browser-fixture.mjs`, `docs/qa/grupo-whatsapp/README.md`

**Interfaces:**
- Consumes: `communityWhatsappUrl` from Store, shared `getCommunityWhatsappUrl`, existing `WhatsAppIcon`.
- Produces: `CommunityWhatsapp({ url }: { url?: string | null })` returning null for absent/invalid URL or a centered CTA section.

- [x] **Step 1: Add render tests for user-visible behavior**
Use `renderToStaticMarkup(createElement(CommunityWhatsapp, {url}))` and happy-dom as existing suite. Assert configured link has exact href, accessible label, target/rel; null/undefined/unsafe values return empty markup. Exercise shared item renderer and empty product branch with existing mock patterns to verify one CTA and unchanged support. Include a store without group and ensure none. No tests merely checking class names.
```ts
const html = renderToStaticMarkup(createElement(CommunityWhatsapp, { url: 'https://chat.whatsapp.com/Example?mode=gi_t' }))
expect(html).toContain('Entrar no grupo do WhatsApp')
expect(html).toContain('href="https://chat.whatsapp.com/Example?mode=gi_t"')
expect(html).toContain('rel="noopener noreferrer"')
expect(renderToStaticMarkup(createElement(CommunityWhatsapp, {url: null}))).toBe('')
```

- [x] **Step 2: Run focused tests and record red**
Run `npx vitest run tests/membros/community-whatsapp.test.ts`.

- [x] **Step 3: Add component and styles**
Read Next local CSS and server/client guide plus frontend-design skill to preserve existing design. Resolve actual existing icon import rather than adding a dependency.
```tsx
export function CommunityWhatsapp({ url }: { url?: string | null }) {
  const href = getCommunityWhatsappUrl(url)
  if (!href) return null
  return <div className={styles.container}>
    <a className={styles.pill} href={href} target="_blank" rel="noopener noreferrer">
      <WhatsAppIcon className={styles.icon} />
      <span>Entrar no grupo do WhatsApp</span>
    </a>
  </div>
}
```
```css
.container { display:flex; justify-content:center; padding:0 20px 28px; }
.pill { display:inline-flex; align-items:center; justify-content:center; gap:10px; max-width:100%; min-height:48px; padding:12px 22px; border:1px solid #25d366; border-radius:999px; background:#25d366; color:#102b1a; font-size:14px; font-weight:700; line-height:1.4; text-align:center; text-decoration:none; transition:background-color .15s ease; }
.pill:hover { background:#20bd5a; }
.pill:focus-visible { outline:3px solid var(--member-focus, #c8192b); outline-offset:4px; }
.icon { width:21px; height:21px; flex-shrink:0; }
@media(prefers-reduced-motion:reduce) { .pill { transition:none; } }
```
Insert `<CommunityWhatsapp url={store.communityWhatsappUrl} />` after `</main>` in item-content and empty product page. No layout-level insertion, no slug guard: presence of valid per-store configuration controls rendering, making other stores reusable without leaking the architecture group.

- [x] **Step 4: Prepare safe local browser fixture**
Reuse `createFixture` from `scripts/qa-members-browser-fixture.mjs`. It returns mutable tables; add community field for architecture, accepted member terms, a second no-group store with a paid product/item, and empty product with access. Use only localhost backend and synthetic credentials. Spawn Next with an allowlisted environment, `windowsHide:true`, distinct available ports, and SIGINT/SIGTERM cleanup. Document test login, routes and commands. Do not use real .env values or send mail. The controller will operate agent-browser and capture evidence.

- [x] **Step 5: Run task tests and commit**
Run `npx vitest run tests/membros/community-whatsapp.test.ts tests/membros/architecture-theme.test.ts tests/membros/member-theme.test.ts`; commit as `feat: add WhatsApp group pill to member lessons`.

## Controller final validation
- Run full `npm test`, `npm run lint`, `npm run build` using synthetic environment as needed.
- Generate a real email preview from accessNoticeEmail with a fake notice and supplied invitation; save under QA artifacts.
- Use `npx --yes agent-browser@0.38.1 --session grupo-whatsapp-qa --allowed-domains 127.0.0.1,localhost open <local URL>`. Login with fixture user, navigate product/direct item/empty product, inspect link, tab focus, screenshot 1440x900 and 375x812. Confirm CTA centered above footer, no overlap/overflow/errors. Check no-group store and public login omit CTA. Verify rendered email preview desktop/mobile. Do not navigate into/join the WhatsApp group.
- Independent task review after every implementation; final broad review after tasks, with browser QA running independently if safe. Generate review-package files for reviewers.
- Copy only feature diff back to original workspace via checked patch, preserving baseline changes. Include migration/deploy instructions and QA evidence in final handoff; no live deployment or mass sending.

## Self-review
Spec requirements map to Tasks 1 (configuration/isolation/propagation), 2 (email) and 3 (UI), plus controller browser checks. Interfaces agree: optional Store/StoreRef property, nullable StoreInput, single validator. Shared Task 1 interfaces are prerequisites to Tasks 2 and 3; implementers run sequentially, independent review/tool setup may overlap. All five review-focus conditions have test owners. Execution method supplied by user: subagent-driven, with autonomous plan review explicitly authorized.
