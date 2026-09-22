# Segurança e rotas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir falhas comprovadas de login, roteamento e entrega mantendo contratos e visual existentes.

**Architecture:** Mudanças pequenas nos guards, repositório de avisos e editor de ofertas. Migração SQL independente, não aplicada e não necessária para executar o código publicado.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Vitest, PGlite somente para testes SQL locais, agent-browser.

**Spec:** `docs/superpowers/specs/2026-09-22-seguranca-rotas-design.md`

## Global Constraints

- Preservar visual, login do aluno só por e-mail, acesso calculado e riscos aceitos em `docs/conferencia-gpt-cuspidora.md`.
- Windows/PowerShell, Select-String, Next.js 16: consultar documentação local antes de editar APIs.
- Não alterar `.env.local`, variáveis Vercel, DNS ou serviços privados de produção para testar.
- TDD em correções; testes, TypeScript, lint, build e navegador ao final.
- Criar migração com timestamp, avisar e NÃO aplicar. Código publicado deve funcionar no schema atual.
- Agentes não fazem push, não alteram arquivos de outros agentes e não criam subagentes. Controlador faz commits para evitar concorrência no índice Git.

## Review Focus

- Prefixos de admin em slugs válidos: Task 1 cobre entrada, manifesto, vitrine e painel exato.
- Não autorizado versus falha do provedor OTP: Task 1 compara resposta pública e chamadas privadas.
- Compra anterior e falha parcial multiloja: Task 2 exige cobertura dos produtos atuais e idempotência do retry.
- Fila com primeiros grupos inelegíveis: Task 2 exige envio seguinte sem ultrapassar tentativas/cota.
- Evento atrasado após troca administrativa de titular: Task 4 preserva e-mail e status final.

### Task 1: Corrigir fronteira admin/loja e privacidade do login

**Files:** `src/lib/supabase/proxy.ts`, `src/app/admin/entrar/actions.ts`, novos `tests/auth/proxy.test.ts`, `tests/auth/admin-login-action.test.ts`.

**Interfaces:** Mantém `updateSession(request)` e actions `enviarCodigo`/`verificarCodigo` e `AdminLoginState`.

- [ ] Escrever testes com `NextRequest` real e `createServerClient` simulado:
```ts
expect((await updateSession(new NextRequest('http://localhost/admin-loja/entrar'))).headers.get('location')).toBeNull()
expect((await updateSession(new NextRequest('http://localhost/admin-loja'))).headers.get('location')).toBe('http://localhost/admin-loja/entrar')
```
Cobrir `administracao`, manifesto, `/admin`, `/admin/pedidos`, `/admin/entrar`, `/admin/entrar-extra`, sessão válida e renovação de cookies existente. Testar actions com `vi.mock`: desconhecido e autorizado têm `{step:'code',email,error:null}` ao solicitar; verificação inválida tem mesmo erro, sem chamada a Supabase para desconhecido; admin verificado redireciona.
- [ ] Rodar `npx vitest run tests/auth/proxy.test.ts tests/auth/admin-login-action.test.ts` e registrar falhas originais.
- [ ] Implementar fronteira exata:
```ts
const isAdminPath = path === '/admin' || path.startsWith('/admin/')
const needsAdmin = isAdminPath && path !== '/admin/entrar'
```
Para solicitação de OTP, apenas allowlist pode chamar provedor, mas retorno público é uniforme inclusive erro do provedor. Para verificação não autorizada, retornar `{step:'code',email,error:'Código inválido ou expirado.'}`. Manter sucesso autenticado e validação allowlist.
- [ ] Rodar testes focados e salvar relatório com comandos e RED/GREEN no workspace SDD. Controlador revisa e commita em português.

### Task 2: Recuperar avisos de produtos novos e destravar lote

**Files:** `src/lib/orders/process-postback.ts`, `src/lib/data/postback-repo.ts`, `src/lib/email/batch.ts`, `tests/helpers/fakes.ts`, `tests/orders/process-postback.test.ts`, `tests/orders/postback-repo.test.ts`, `tests/email/batch.test.ts`.

**Interfaces:** substituir `hasNoticeForStore(customerId,storeId)` por `hasNoticeForProducts(customerId:string,storeId:string,productIds:string[]):Promise<boolean>`; fallback `logFailedNotice` recebe `productIds:string[]`. Nenhuma mudança de schema.

- [ ] Acrescentar reprodução: compra anterior PACK na loja A; nova compra ATLAS em A e bump em B; primeira execução falha em B após gravar A; retry envia A e B; segunda repetição não envia. FakeNotifier deve persistir productIds reais em notices.
```ts
expect(notifier.sent.filter(n => n.store.id === ARQ.id).at(-1)?.products.map(p => p.id)).toContain('p-atlas')
```
Cobrir cobertura parcial, separação cliente/loja, vazio não cobre produtos, erro de leitura, fallback com IDs quando conhecidos, statuses já registrados preservados. Para lote: inelegível seguido de elegível e um slot envia segundo; falhas de envio consomem tentativa; limite 100 e cota zero.
- [ ] Rodar `npx vitest run tests/orders tests/email/batch.test.ts` e registrar RED.
- [ ] Carregar produtos antes de decidir skip; verificar cada produto por consulta `email_log` com `.eq('customer_id',customerId).eq('store_id',storeId).contains('product_ids',[productId]).limit(1)`, retornando false quando falta cobertura. Sem query que trunque uma união de registros a 1000. Reusar IDs conhecidos em `logFailedNotice`. Recuperação não deve declarar sucesso quando houve erro. Produtos vazios não geram envio.
```ts
let attempted = 0
for (const group of groups) {
  if (attempted >= slots) break
  const notice = await deps.buildNotice(group)
  if (!notice) { summary.skipped++; continue }
  attempted++
  // enviar, contar enviado/falhou e resolver somente sucesso
}
```
Calcular remaining como grupos ainda não visitados, preservando resumo anterior; skipped é visitado e não resolvido.
- [ ] Rodar testes focados, registrar RED/GREEN e diff para revisão/commit pelo controlador.

### Task 3: Preservar código de oferta cadastrada

**Files:** `src/lib/data/products-admin.ts`, `src/app/admin/(painel)/ofertas/offer-form.tsx`, novo `tests/admin/offer-persistence.test.ts`.

**Interfaces:** `saveOffer(input:OfferInput):Promise<void>` preservada. Novas ofertas inalteradas.

- [ ] Mockar Supabase e reproduzir alteração OLD → NEW em id existente; esperar rejeição antes de `update`, `upsert` ou `delete`. Cobrir nome editável com mesmo código, criação, oferta ausente, falha na leitura.
```ts
await expect(saveOffer({ ...input, id:'existing', paytProductCode:'NEW' })).rejects.toThrow('código')
expect(update).not.toHaveBeenCalled()
```
- [ ] Rodar `npx vitest run tests/admin/offer-persistence.test.ts` e confirmar RED.
- [ ] Antes de qualquer escrita, consultar oferta por id+loja e impedir mudança de código; update existente não envia `payt_product_code` no payload, evitando sobrescrever valor por corrida. Mostrar campo readonly em edição e instrução textual curta de criar nova oferta para outro código, mantendo estilo. Criação continua com código.
- [ ] Rodar teste focado e registrar relatório. Controlador revisa e commita.

### Task 4: Preparar migração de titularidade e testá-la localmente

**Files:** novo `supabase/migrations/20260922150000_order_payment_identity.sql`, novo `tests/orders/payment-identity-sql.test.ts`, `package.json`, `package-lock.json`.

**Interfaces:** assinatura/retorno/grants de `apply_order_status` inalterados. Nenhuma dependência do aplicativo na migração.

- [ ] Instalar `@electric-sql/pglite` como devDependency. Criar banco local em memória com tabela mínima orders compatível com a função, roles anon/authenticated/service_role. Testes executam função anterior e depois migration de arquivo; primeira execução sem migration deve reproduzir e-mail antigo.
```ts
expect(rows[0].customer_email).toBe('novo@example.com')
```
Casos: pendente antigo → pago novo normaliza email e atualiza nome; duplicata e pendente atrasado não sobrescrevem titular; alteração administrativa seguida por duplicata antiga preservada; reembolso e chargeback mantêm titular e revogam; ranks não retrocedem; grant somente service_role.
- [ ] Verificar RED com função anterior e salvar saída.
- [ ] Criar `CREATE OR REPLACE FUNCTION` preservando função atual e adicionando ao update:
```sql
customer_email = case when o.status = 'pendente' and p_status = 'pago' then lower(btrim(p_customer_email)) else o.customer_email end,
customer_name = case when o.status = 'pendente' and p_status = 'pago' then p_customer_name else o.customer_name end,
```
Normalizar email também na inserção. Preservar SQL security definer, search_path vazio, assinatura e revoke/grant. Não corrigir histórico por heurística. Não executar contra Supabase.
- [ ] Rodar `npx vitest run tests/orders/payment-identity-sql.test.ts`, registrar GREEN; documentar que depende de aplicação manual. Controlador avisa, revisa e commita arquivo sem aplicar.

## Validação integrada e entrega

- [ ] Revisão independente por tarefa, com TDD verificado; revisão final do conjunto.
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (separados, não pipeline).
- [ ] Aplicativo real com fixture backend HTTP local; `agent-browser` em 375px e 1440px. Navegar login, vitrine, produto e item, negar outra loja e painel, abrir compra bloqueada e verificar inexistentes. Evidências fora do código ou relatório em docs.
- [ ] Registrar resultados e decisões em `docs/status-seguranca-2026-09-22.md`, incluindo SQL pendente e limitações da simulação.
- [ ] Integrar somente após verificações; commit/push autorizados. Não aplicar SQL nem publicar código que dependa dele.
