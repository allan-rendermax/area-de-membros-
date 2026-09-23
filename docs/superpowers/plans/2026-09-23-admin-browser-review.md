# Admin Browser Trust Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Entregar o login administrativo com confiança de sete dias revisado e validado no navegador.

**Architecture:** Preservar o marcador HMAC vinculado ao usuário e à sessão Supabase. Revisar segurança e limites em paralelo com a interação do formulário; executar testes de navegador contra a aplicação Next real com um provedor local de teste quando necessário, sem condicional de teste em produção.

**Tech Stack:** Next.js 16.3.5, React 19, Supabase SSR, Vitest 5, agent-browser 0.38.1, PowerShell/Node.js.

**Spec:** `docs/superpowers/specs/2026-09-23-admin-browser-review.md`

## Global Constraints

- Expiração absoluta de 604800 segundos desde a confirmação do código.
- Confiança opcional, desmarcada inicialmente; preservar a escolha após erros e reenvio.
- Nunca substituir sessão autenticada e allowlist por cookie isolado.
- Não criar bypass de autenticação para testes em código de produção.
- Manter Next.js 16.3.5, Supabase e as dependências do produto.
- Preservar arquivos alheios à autenticação; não publicar remotamente.
- Operar nesta worktree. Agentes não fazem commits em paralelo; o coordenador registra os commits após cada entrega.

## Review Focus

1. React pode limpar campos não controlados após uma Server Action: testar escolha marcada após código inválido e reenvio (Task 2).
2. Cookies copiados, timestamps futuros, assinatura alterada e segredo rotacionado nunca autorizam acesso (Task 1).
3. Falhas do provedor, claims ausentes e allowlist modificada não autorizam nem criam nova confiança (Task 1).
4. Renovação do access token preserva a identidade da sessão, sem prorrogar o prazo de sete dias (Task 1 + QA Task 2).
5. Usuário no celular precisa identificar os campos e operar checkbox/erros sem corte ou overflow (Task 2).

## Task 1: Revisar a política de sessão e suas fronteiras

**Files:**
- Inspect/modify only if a reproducible defect: `src/lib/auth/admin-browser-session.ts`, `src/lib/auth/require-admin.ts`, `src/app/admin/entrar/actions.ts`, `src/app/sair/route.ts`.
- Test: `tests/auth/admin-browser-session.test.ts`, `tests/auth/admin-login-action.test.ts`, optional focused `tests/auth/admin-browser-token.test.ts`.

**Interfaces:**
- Consumes: `createAdminBrowserSession(userId, sessionId, secret, now?)`, `isAdminBrowserSessionValid(value, userId, sessionId, secret, now?)`, `verificarCodigo(state, formData)`, `requireAdmin()`.
- Produces: same public interfaces and form field `rememberBrowser=on`; report of concrete findings and passing regression tests.

- [x] Read spec, existing implementation/tests and local Next cookies/authentication documentation.
- [x] Extend behavior tests with explicit boundary cases. Pure-token example:

```ts
const issuedAt = Date.UTC(2026, 8, 23, 12)
const token = createAdminBrowserSession('user-a', 'session-a', 'secret-a', issuedAt)
expect(isAdminBrowserSessionValid(token, 'user-a', 'session-a', 'secret-a', issuedAt + 604799999)).toBe(true)
expect(isAdminBrowserSessionValid(token, 'user-a', 'session-a', 'secret-a', issuedAt + 604800000)).toBe(false)
expect(isAdminBrowserSessionValid(token, 'user-a', 'session-b', 'secret-a', issuedAt)).toBe(false)
expect(isAdminBrowserSessionValid(token, 'user-b', 'session-a', 'secret-a', issuedAt)).toBe(false)
expect(isAdminBrowserSessionValid(token, 'user-a', 'session-a', 'secret-b', issuedAt)).toBe(false)
expect(isAdminBrowserSessionValid(token, 'user-a', 'session-a', 'secret-a', issuedAt - 1)).toBe(false)
```

- [x] Exercise malformed tokens `''`, `'.'`, `'NaN.x'`, `'Infinity.x'`, `'1.x.extra'` and missing claim/session/provider failures through existing action/session tests. Assert denial or neutral error and no trust cookie. Exercise token refresh with the same session id and expiry unchanged.
- [x] Run `npm test -- tests/auth`; reproduce any discovered production defect as a failing test before the minimal fix. Passing coverage alone does not justify production changes.
- [x] Review cookie issuance against real Supabase verifyOtp/getClaims semantics in installed sources. Preserve `httpOnly`, production `secure`, `sameSite=lax`, and session binding.
- [x] Report changed files, exact tests, confirmed defects and any untested integration. Do not edit form or frontend tests owned by Task 2.
- [x] Coordinator creates a scoped commit after review; no worker commits.

## Task 2: Validar e ajustar a interação do login no navegador

**Files:**
- Modify when needed: `src/app/admin/entrar/form.tsx`.
- Test: `tests/auth/admin-login-form.test.ts`, optional `tests/auth/admin-login-interaction.test.ts`.
- Create reusable local QA runner/fixture in `scripts/qa-admin-browser*` only if needed; evidence/report under `docs/qa/admin-browser/`.
- Must not modify backend files or backend tests owned by Task 1.

**Interfaces:**
- Consumes: unchanged `AdminLoginState`, `enviarCodigo`, `verificarCodigo`, field `rememberBrowser=on`; Next server at a dedicated loopback port.
- Produces: stable explicit checkbox choice, accessible usable form and documented agent-browser evidence.

- [x] Read spec, form, existing component tests and local Next Server Action documentation.
- [x] Use the real React renderer/happy-dom for a regression if uncontrolled input reset loses the user's choice. Test the actual controlled state across action results; do not assert source strings. Minimal expected behavior: render code step, check checkbox, return invalid-code action state, assert checked, then resend and assert checked.
- [x] If the defect reproduces, use controlled state in the component:

```tsx
const [rememberBrowser, setRememberBrowser] = useState(false)
// Retain the existing name/type and style.
<input name="rememberBrowser" type="checkbox" checked={rememberBrowser}
  onChange={(event) => setRememberBrowser(event.target.checked)} />
```

- [x] Provide accessible labels for email/code when inspection shows they depend only on placeholders; keep the current visual design and Portuguese copy.
- [x] Use `npx --yes agent-browser@0.38.1 --session admin-browser-review` for browser control. Read CLI help first. Use only dedicated local test ports and fictitious data. Never invoke external mail delivery.
- [x] Test initial email screen, code step, check/uncheck, invalid code, resend, desktop 1440x900 and mobile 390x844; inspect JS errors and overflow. Save screenshots and a concise command/outcome report.
- [x] To validate authenticated redirects/persistence, use a local Supabase-compatible HTTP fixture with signed JWT and auth/user/logout endpoints plus empty fixture DB responses as required by the actual admin pages. Point only the dedicated Next process at this fixture using environment variables; do not edit application auth for testing. If fixture integration cannot model a provider aspect, explicitly record it, retaining backend contract tests.
- [x] Verify successful login with checked/unchecked choice, cookie lifetime, revisiting login without OTP, reload, expiry rejection, logout clearing, and invalid/tampered cookie rejection. Avoid recording raw session credentials in tracked artifacts.
- [x] Run affected tests; report evidence, runtime limits and changes. Coordinator reviews and commits only owned files.

## Final verification and delivery (coordinator)

- [x] Run independent task review(s), fix substantiated findings through the original worker and re-review scoped fixes.
- [x] Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check` after integration. The pre-existing unused `loja` warning in `scripts/trocar-admin-e-aluno.mjs` is outside scope.
- [x] Run a final whole-change review including the original seven-day implementation, new regressions and browser evidence.
- [x] Copy only reviewed auth, tests, QA and documentation files back to the original workspace, checking for concurrent changes before replacing a file. Preserve unrelated dirty files. Leave local changes ready for user review; no push/deploy.
- [x] Record tests, browser evidence and limitations in `docs/qa/admin-browser/review.md`; stop only test processes/sessions created for this plan.

## Approval and self-review

Approved for execution by the coordinator under the user's explicit instruction to approve and execute without further questions. Both tasks preserve the public auth interface and own disjoint production/test files. The five review-focus items map to concrete test steps above. No remote changes are part of this plan.


