# Área de Membros Própria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Área de membros que recebe postbacks da Payt, cria clientes, libera/retira acesso a materiais (PDFs por link) e exibe uma vitrine com itens liberados e bloqueados, com um admin para cadastro e suporte.

**Architecture:** Next.js 16 (App Router) na Vercel, Supabase (Postgres + Auth) acessado **somente no servidor** com a chave secreta. Toda a regra de negócio fica em funções puras em `src/lib/domain`, `src/lib/payt`, `src/lib/access`, `src/lib/orders` e `src/lib/auth`, testadas com Vitest usando fakes; `src/lib/data` contém as implementações que falam com o Supabase. O acesso é calculado (pedidos pagos → código do produto → oferta → materiais), nunca gravado.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, Tailwind CSS 4, `@supabase/ssr` 0.12, `@supabase/supabase-js` 2.116, `resend` 6, `zod` 4, Vitest 4. Node 24.

**Spec:** `docs/superpowers/specs/2026-09-16-area-de-membros-design.md`

## Global Constraints

- Idioma da interface, emails e mensagens de erro: **português do Brasil**.
- Loja única na v1: slug `arquitetura`, lida de `DEFAULT_STORE_SLUG`.
- Status internos (exatos): `pendente` (0), `pago` (1), `cancelado` (2), `reembolsado` (2), `chargeback` (2). Status nunca retrocede nem muda entre níveis iguais.
- Emails sempre normalizados com `normalizeEmail` (trim + minúsculas) antes de gravar ou comparar.
- Cliente entra **só com email** (sem senha, sem código). Admin entra com **código de 6 dígitos**. Emails de `ADMIN_EMAILS` são recusados no login de cliente.
- RLS habilitado em todas as tabelas, **sem políticas**. Nenhum acesso ao banco pelo navegador. Chave secreta nunca em código de cliente.
- `download_url` só é enviado ao navegador para materiais liberados.
- Next.js 16: arquivo `src/proxy.ts` (não `middleware.ts`); `cookies()`, `headers()`, `params` e `searchParams` são assíncronos.
- Limite de login: 20 tentativas por IP a cada 15 minutos.
- Alerta de compartilhamento: 4 ou mais aparelhos distintos nos últimos 30 dias.
- Commits terminam com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Variáveis de ambiente

| Nome | Exemplo | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Sessão (SSR) |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` | Acesso ao banco e Auth Admin (servidor) |
| `PAYT_INTEGRATION_KEY` | chave do painel Payt | Validar postback |
| `RESEND_API_KEY` | `re_...` | Emails |
| `EMAIL_FROM` | `Arquitetura <acesso@dominio.com>` | Remetente |
| `APP_URL` | `https://area-membros.vercel.app` | Links nos emails |
| `ADMIN_EMAILS` | `arq.allanp@gmail.com` | Lista separada por vírgula |
| `DEFAULT_STORE_SLUG` | `arquitetura` | Loja da v1 |

## Estrutura de arquivos

```
src/
  proxy.ts                               renova sessão e redireciona rotas protegidas
  lib/
    env.ts                               leitura tipada das variáveis
    domain/email.ts                      normalizeEmail, isValidEmail
    domain/types.ts                      OrderStatus, STATUS_RANK, Store, CustomerRow, Material, OfferLink
    payt/status.ts                       mapPaytStatus, canTransition
    payt/parse.ts                        parsePaytPostback
    access/access.ts                     grantedMaterialIds, buildVitrine
    orders/process-postback.ts           processPostback + interfaces PostbackRepo, Mailer
    auth/customer-login.ts               decideCustomerLogin
    auth/admin.ts                        isAdminEmail
    auth/require-admin.ts                requireAdmin (servidor)
    supabase/server.ts                   cliente SSR com cookies
    supabase/admin.ts                    cliente com chave secreta
    supabase/proxy.ts                    updateSession
    email/templates.ts                   accessGrantedEmail, escapeHtml
    email/resend-mailer.ts               createResendMailer
    data/stores.ts                       getStoreBySlug, getDefaultStore
    data/customers.ts                    clientes, aparelhos, tentativas de login
    data/catalog.ts                      materiais, ofertas, capas
    data/orders.ts                       pedidos e titulos por produto
    data/access.ts                       loadCustomerAccess
    data/postback-repo.ts                createPostbackRepo
  app/
    layout.tsx, globals.css
    page.tsx                             vitrine
    vitrine/locked-card.tsx              card bloqueado (cliente)
    entrar/page.tsx, entrar/form.tsx, entrar/actions.ts
    sair/route.ts
    api/webhooks/payt/route.ts
    admin/entrar/page.tsx, admin/entrar/form.tsx, admin/entrar/actions.ts
    admin/(painel)/layout.tsx
    admin/(painel)/page.tsx
    admin/(painel)/materiais/page.tsx, [id]/page.tsx, material-form.tsx, actions.ts
    admin/(painel)/ofertas/page.tsx, [id]/page.tsx, offer-form.tsx, actions.ts
    admin/(painel)/pedidos/page.tsx
    admin/(painel)/clientes/page.tsx, [id]/page.tsx, actions.ts
supabase/migrations/20260916000001_schema.sql
tests/
  helpers/fakes.ts
  domain/email.test.ts
  payt/status.test.ts, payt/parse.test.ts
  access/access.test.ts
  orders/process-postback.test.ts
  auth/customer-login.test.ts
  email/templates.test.ts
  fixtures/payt-paid.json
```

---

### Task 1: Projeto base, repositório e publicação vazia

**Files:**
- Create: projeto Next.js na raiz, `vitest.config.ts`, `.env.example`, `src/lib/env.ts`, `src/lib/domain/email.ts`
- Test: `tests/domain/email.test.ts`

**Interfaces:**
- Produces: `normalizeEmail(value: string): string`, `isValidEmail(value: string): boolean`, objeto `env` com getters `supabaseUrl`, `supabasePublishableKey`, `supabaseSecretKey`, `paytIntegrationKey`, `resendApiKey`, `emailFrom`, `appUrl`, `adminEmails: string[]`, `defaultStoreSlug`.

- [ ] **Step 1: Gerar o projeto em pasta temporária e mover para a raiz** (a raiz já tem `docs/` e `.git`, e o `create-next-app` recusa pasta não vazia)

```powershell
npx create-next-app@16 web-tmp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git --yes
Get-ChildItem web-tmp -Force | Move-Item -Destination . -Force
Remove-Item web-tmp -Recurse -Force
```

- [ ] **Step 2: Instalar dependências**

```powershell
npm install @supabase/ssr @supabase/supabase-js resend zod
npm install -D vitest
```

- [ ] **Step 3: Configurar Vitest**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
```

Em `package.json`, dentro de `"scripts"`, adicionar: `"test": "vitest run"`.

- [ ] **Step 4: Escrever o teste que falha**

`tests/domain/email.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'

describe('normalizeEmail', () => {
  it('remove espaços e passa para minúsculas', () => {
    expect(normalizeEmail('  Joao.Silva@Gmail.COM ')).toBe('joao.silva@gmail.com')
  })
})

describe('isValidEmail', () => {
  it('aceita email comum', () => {
    expect(isValidEmail('joao@gmail.com')).toBe(true)
  })
  it('recusa texto sem arroba ou domínio', () => {
    expect(isValidEmail('joao')).toBe(false)
    expect(isValidEmail('joao@gmail')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})
```

- [ ] **Step 5: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "@/lib/domain/email"`

- [ ] **Step 6: Implementar**

`src/lib/domain/email.ts`:
```ts
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
```

`src/lib/env.ts`:
```ts
import { normalizeEmail } from '@/lib/domain/email'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

export const env = {
  get supabaseUrl() { return required('NEXT_PUBLIC_SUPABASE_URL') },
  get supabasePublishableKey() { return required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') },
  get supabaseSecretKey() { return required('SUPABASE_SECRET_KEY') },
  get paytIntegrationKey() { return required('PAYT_INTEGRATION_KEY') },
  get resendApiKey() { return required('RESEND_API_KEY') },
  get emailFrom() { return required('EMAIL_FROM') },
  get appUrl() { return required('APP_URL').replace(/\/$/, '') },
  get adminEmails() {
    return required('ADMIN_EMAILS').split(',').map(normalizeEmail).filter(Boolean)
  },
  get defaultStoreSlug() { return required('DEFAULT_STORE_SLUG') },
}
```

`.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
PAYT_INTEGRATION_KEY=
RESEND_API_KEY=
EMAIL_FROM=
APP_URL=http://localhost:3000
ADMIN_EMAILS=
DEFAULT_STORE_SLUG=arquitetura
```

Confirmar que `.gitignore` contém `.env*` e adicionar a linha `!.env.example` logo abaixo.

- [ ] **Step 7: Rodar testes e build**

Run: `npm test` → Expected: PASS (3 testes)
Run: `npm run build` → Expected: build concluído sem erros

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m @'
chore: projeto Next.js base com Vitest

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
```

- [ ] **Step 9: Publicar no GitHub** (checkpoint com o dono do negócio)

Pedir ao usuário que crie um repositório **privado e vazio** em github.com chamado `area-de-membros` e informe a URL. Então:

```powershell
git branch -M main
git remote add origin <URL informada>
git push -u origin main
```

- [ ] **Step 10: Criar o projeto na Vercel ligado ao GitHub**

Usar `mcp__claude_ai_Vercel__list_teams` para descobrir o time, depois `mcp__claude_ai_Vercel__create_git_project` apontando para o repositório. Se o conector não tiver acesso ao repositório, orientar o usuário a importar em vercel.com/new. Confirmar com `mcp__claude_ai_Vercel__list_deployments` que o deploy terminou em `READY` e anotar a URL `*.vercel.app` (vira `APP_URL`).

---

### Task 2: Banco de dados no Supabase

**Files:**
- Create: `supabase/migrations/20260916000001_schema.sql`, `src/lib/domain/types.ts`

**Interfaces:**
- Produces (SQL): tabelas `stores`, `materials`, `offers`, `offer_materials`, `customers`, `orders`, `payt_events`, `customer_devices`, `login_attempts`; função `apply_order_status(p_store_id uuid, p_transaction_id text, p_product_code text, p_product_name text, p_customer_email text, p_customer_name text, p_status text, p_status_rank smallint, p_payt_type text, p_is_test boolean, p_amount_cents integer) returns table(out_order_id uuid, out_changed boolean, out_status text)`; função `get_auth_user_id_by_email(p_email text) returns uuid`; bucket público `covers`; loja `arquitetura`.
- Produces (TS): tipos abaixo.

- [ ] **Step 1: Criar o projeto Supabase** (checkpoint com o dono do negócio)

`mcp__claude_ai_Supabase__list_organizations` → confirmar a organização com o usuário → `mcp__claude_ai_Supabase__create_project` com nome `area-de-membros` e região `sa-east-1`. Aguardar status ativo com `mcp__claude_ai_Supabase__get_project`. Obter URL com `get_project_url` e chave publicável com `get_publishable_keys`. A chave secreta (`sb_secret_...`) o usuário copia em Project Settings → API Keys.

Criar `.env.local` com todas as variáveis de `.env.example` preenchidas (as de Resend podem usar `onboarding@resend.dev` como `EMAIL_FROM` até a Task 12; `PAYT_INTEGRATION_KEY` vem do painel da Payt).

- [ ] **Step 2: Escrever a migração**

`supabase/migrations/20260916000001_schema.sql`:
```sql
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_url text,
  primary_color text not null default '#1f2937',
  support_url text,
  created_at timestamptz not null default now()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  description text not null default '',
  cover_url text,
  download_url text not null,
  checkout_url text,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index materials_store_id_idx on public.materials(store_id);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  payt_product_code text not null,
  created_at timestamptz not null default now(),
  unique (store_id, payt_product_code)
);

create table public.offer_materials (
  offer_id uuid not null references public.offers(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  primary key (offer_id, material_id)
);
create index offer_materials_material_id_idx on public.offer_materials(material_id);

create table public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  blocked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  payt_transaction_id text not null,
  payt_product_code text not null,
  payt_product_name text not null default '',
  customer_email text not null,
  customer_name text not null default '',
  status text not null check (status in ('pendente','pago','cancelado','reembolsado','chargeback')),
  status_rank smallint not null,
  payt_type text not null default 'order',
  is_test boolean not null default false,
  amount_cents integer,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payt_transaction_id, payt_product_code)
);
create index orders_customer_email_idx on public.orders(customer_email);
create index orders_store_created_idx on public.orders(store_id, created_at desc);

create table public.payt_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  payload jsonb not null,
  key_valid boolean,
  outcome text,
  processed_at timestamptz,
  error text
);
create index payt_events_received_idx on public.payt_events(received_at desc);

create table public.customer_devices (
  customer_id uuid not null references public.customers(id) on delete cascade,
  device_hash text not null,
  user_agent text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (customer_id, device_hash)
);

create table public.login_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index login_attempts_ip_created_idx on public.login_attempts(ip, created_at desc);

alter table public.stores enable row level security;
alter table public.materials enable row level security;
alter table public.offers enable row level security;
alter table public.offer_materials enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.payt_events enable row level security;
alter table public.customer_devices enable row level security;
alter table public.login_attempts enable row level security;

create or replace function public.apply_order_status(
  p_store_id uuid,
  p_transaction_id text,
  p_product_code text,
  p_product_name text,
  p_customer_email text,
  p_customer_name text,
  p_status text,
  p_status_rank smallint,
  p_payt_type text,
  p_is_test boolean,
  p_amount_cents integer
) returns table (out_order_id uuid, out_changed boolean, out_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  insert into public.orders (
    store_id, payt_transaction_id, payt_product_code, payt_product_name,
    customer_email, customer_name, status, status_rank, payt_type, is_test,
    amount_cents, paid_at
  ) values (
    p_store_id, p_transaction_id, p_product_code, p_product_name,
    p_customer_email, p_customer_name, p_status, p_status_rank, p_payt_type, p_is_test,
    p_amount_cents, case when p_status = 'pago' then now() end
  )
  on conflict (payt_transaction_id, payt_product_code) do nothing
  returning id into v_id;

  if v_id is not null then
    return query select v_id, true, p_status;
    return;
  end if;

  update public.orders o
     set status = p_status,
         status_rank = p_status_rank,
         paid_at = coalesce(o.paid_at, case when p_status = 'pago' then now() end),
         updated_at = now()
   where o.payt_transaction_id = p_transaction_id
     and o.payt_product_code = p_product_code
     and o.status_rank < p_status_rank
  returning o.id, o.status into v_id, v_status;

  if v_id is not null then
    return query select v_id, true, v_status;
    return;
  end if;

  return query
    select o.id, false, o.status
      from public.orders o
     where o.payt_transaction_id = p_transaction_id
       and o.payt_product_code = p_product_code;
end;
$$;

revoke execute on function public.apply_order_status(uuid, text, text, text, text, text, text, smallint, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.apply_order_status(uuid, text, text, text, text, text, text, smallint, text, boolean, integer) to service_role;

create or replace function public.get_auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(p_email) limit 1
$$;

revoke execute on function public.get_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_auth_user_id_by_email(text) to service_role;

insert into public.stores (slug, name) values ('arquitetura', 'Arquitetura');

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;
```

- [ ] **Step 3: Aplicar a migração**

`mcp__claude_ai_Supabase__apply_migration` com `name: "schema"` e o SQL acima.

- [ ] **Step 4: Verificar a regra de status no banco**

`mcp__claude_ai_Supabase__execute_sql`:
```sql
with s as (select id from public.stores where slug = 'arquitetura')
select 'a' as passo, * from public.apply_order_status((select id from s), 'tx-verif', 'p1', 'Teste', 'x@y.com', 'X', 'pago', 1::smallint, 'order', true, 100)
union all
select 'b', * from public.apply_order_status((select id from s), 'tx-verif', 'p1', 'Teste', 'x@y.com', 'X', 'pago', 1::smallint, 'order', true, 100)
union all
select 'c', * from public.apply_order_status((select id from s), 'tx-verif', 'p1', 'Teste', 'x@y.com', 'X', 'reembolsado', 2::smallint, 'order', true, 100)
union all
select 'd', * from public.apply_order_status((select id from s), 'tx-verif', 'p1', 'Teste', 'x@y.com', 'X', 'pago', 1::smallint, 'order', true, 100);
```
Expected: `a` changed=true pago · `b` changed=false pago · `c` changed=true reembolsado · `d` changed=false reembolsado.

Se o Postgres executar os ramos do `union all` fora de ordem, rodar as quatro chamadas em quatro `execute_sql` separados. Depois limpar:
```sql
delete from public.orders where payt_transaction_id = 'tx-verif';
```

- [ ] **Step 5: Checar advisors**

`mcp__claude_ai_Supabase__get_advisors` (security). Expected: apenas avisos "RLS enabled no policy" (intencional). Qualquer outro aviso deve ser corrigido antes de seguir.

- [ ] **Step 6: Tipos de domínio**

`src/lib/domain/types.ts`:
```ts
export type OrderStatus = 'pendente' | 'pago' | 'cancelado' | 'reembolsado' | 'chargeback'

export const STATUS_RANK: Record<OrderStatus, number> = {
  pendente: 0,
  pago: 1,
  cancelado: 2,
  reembolsado: 2,
  chargeback: 2,
}

export type Store = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  primaryColor: string
  supportUrl: string | null
}

export type CustomerRow = {
  id: string
  email: string
  name: string
  blockedAt: string | null
}

export type Material = {
  id: string
  title: string
  description: string
  coverUrl: string | null
  downloadUrl: string
  checkoutUrl: string | null
  sortOrder: number
  isPublished: boolean
}

export type OfferLink = { productCode: string; materialId: string }

export type OrderRef = { productCode: string; status: OrderStatus }
```

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m @'
feat: esquema do banco e tipos de domínio

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
```

---

### Task 3: Tradução de status e leitura do postback da Payt

**Files:**
- Create: `src/lib/payt/status.ts`, `src/lib/payt/parse.ts`, `tests/fixtures/payt-paid.json`
- Test: `tests/payt/status.test.ts`, `tests/payt/parse.test.ts`

**Interfaces:**
- Consumes: `OrderStatus`, `STATUS_RANK` (Task 2), `normalizeEmail` (Task 1)
- Produces:
  - `mapPaytStatus(raw: string): OrderStatus | null`
  - `canTransition(current: OrderStatus | null, next: OrderStatus): boolean`
  - `type PaytPostback = { transactionId: string; status: string; type: string; isTest: boolean; customerEmail: string; customerName: string; productCode: string; productName: string; amountCents: number | null }`
  - `parsePaytPostback(body: unknown): { ok: true; value: PaytPostback } | { ok: false; error: string }`

> O formato abaixo segue o repositório público `ventuinha/payt-postback`. A Task 6 confirma com um aviso real e ajusta este arquivo e o fixture.

- [ ] **Step 1: Fixture**

`tests/fixtures/payt-paid.json`:
```json
{
  "integration_key": "chave-de-teste",
  "transaction_id": "TX123",
  "seller_id": "S1",
  "status": "paid",
  "type": "order",
  "test": false,
  "tangible": false,
  "customer": { "name": "João Silva", "email": " Joao@Gmail.com " },
  "product": { "name": "Atlas Visual - Plano Completo", "code": "ATLAS-COMPLETO", "sku": "SKU-1", "price": 4700, "quantity": 1 }
}
```

- [ ] **Step 2: Testes que falham**

`tests/payt/status.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { canTransition, mapPaytStatus } from '@/lib/payt/status'

describe('mapPaytStatus', () => {
  it('traduz status conhecidos', () => {
    expect(mapPaytStatus('waiting_payment')).toBe('pendente')
    expect(mapPaytStatus('paid')).toBe('pago')
    expect(mapPaytStatus('canceled')).toBe('cancelado')
    expect(mapPaytStatus('refunded')).toBe('reembolsado')
    expect(mapPaytStatus('chargeback')).toBe('chargeback')
  })
  it('ignora maiúsculas e espaços', () => {
    expect(mapPaytStatus(' PAID ')).toBe('pago')
  })
  it('retorna null para status que não afetam acesso', () => {
    expect(mapPaytStatus('lost_cart')).toBeNull()
    expect(mapPaytStatus('subscription_renewed')).toBeNull()
  })
})

describe('canTransition', () => {
  it('permite qualquer status em pedido novo', () => {
    expect(canTransition(null, 'pendente')).toBe(true)
    expect(canTransition(null, 'reembolsado')).toBe(true)
  })
  it('só avança de nível', () => {
    expect(canTransition('pendente', 'pago')).toBe(true)
    expect(canTransition('pago', 'reembolsado')).toBe(true)
    expect(canTransition('pago', 'pendente')).toBe(false)
    expect(canTransition('reembolsado', 'pago')).toBe(false)
    expect(canTransition('pago', 'pago')).toBe(false)
    expect(canTransition('cancelado', 'chargeback')).toBe(false)
  })
})
```

`tests/payt/parse.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parsePaytPostback } from '@/lib/payt/parse'
import paid from '../fixtures/payt-paid.json'

describe('parsePaytPostback', () => {
  it('extrai os campos usados pelo sistema', () => {
    const result = parsePaytPostback(paid)
    expect(result).toEqual({
      ok: true,
      value: {
        transactionId: 'TX123',
        status: 'paid',
        type: 'order',
        isTest: false,
        customerEmail: 'joao@gmail.com',
        customerName: 'João Silva',
        productCode: 'ATLAS-COMPLETO',
        productName: 'Atlas Visual - Plano Completo',
        amountCents: 4700,
      },
    })
  })

  it('usa o sku quando não há code e aceita ids numéricos', () => {
    const body = { ...paid, transaction_id: 987, product: { name: 'X', sku: 555 } }
    const result = parsePaytPostback(body)
    expect(result.ok && result.value.productCode).toBe('555')
    expect(result.ok && result.value.transactionId).toBe('987')
  })

  it('entende test como texto', () => {
    const result = parsePaytPostback({ ...paid, test: 'true' })
    expect(result.ok && result.value.isTest).toBe(true)
  })

  it('falha sem email válido', () => {
    const result = parsePaytPostback({ ...paid, customer: { name: 'X', email: 'sem-email' } })
    expect(result.ok).toBe(false)
  })

  it('falha sem código de produto', () => {
    const result = parsePaytPostback({ ...paid, product: { name: 'X' } })
    expect(result).toEqual({ ok: false, error: 'produto sem code/sku' })
  })
})
```

- [ ] **Step 3: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — imports `@/lib/payt/status` e `@/lib/payt/parse` não resolvem

- [ ] **Step 4: Implementar**

`src/lib/payt/status.ts`:
```ts
import { STATUS_RANK, type OrderStatus } from '@/lib/domain/types'

const PAYT_STATUS: Record<string, OrderStatus> = {
  waiting_payment: 'pendente',
  paid: 'pago',
  canceled: 'cancelado',
  refunded: 'reembolsado',
  chargeback: 'chargeback',
}

export function mapPaytStatus(raw: string): OrderStatus | null {
  return PAYT_STATUS[raw.trim().toLowerCase()] ?? null
}

export function canTransition(current: OrderStatus | null, next: OrderStatus): boolean {
  if (current === null) return true
  return STATUS_RANK[next] > STATUS_RANK[current]
}
```

`src/lib/payt/parse.ts`:
```ts
import { z } from 'zod'
import { normalizeEmail } from '@/lib/domain/email'

export type PaytPostback = {
  transactionId: string
  status: string
  type: string
  isTest: boolean
  customerEmail: string
  customerName: string
  productCode: string
  productName: string
  amountCents: number | null
}

const idLike = z.union([z.string(), z.number()]).transform(String)

const schema = z.object({
  transaction_id: idLike,
  status: z.string(),
  type: z.string().optional(),
  test: z.union([z.boolean(), z.string(), z.number()]).optional(),
  customer: z.object({
    name: z.string().optional(),
    email: z.string().transform(normalizeEmail).pipe(z.email()),
  }),
  product: z.object({
    name: z.string().optional(),
    code: idLike.optional(),
    sku: idLike.optional(),
    price: z.number().optional(),
  }),
})

export function parsePaytPostback(
  body: unknown,
): { ok: true; value: PaytPostback } | { ok: false; error: string } {
  const parsed = schema.safeParse(body)
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) }

  const data = parsed.data
  const productCode = data.product.code ?? data.product.sku
  if (!productCode) return { ok: false, error: 'produto sem code/sku' }

  return {
    ok: true,
    value: {
      transactionId: data.transaction_id,
      status: data.status,
      type: data.type ?? 'order',
      isTest: data.test === true || data.test === 'true' || data.test === 1 || data.test === '1',
      customerEmail: data.customer.email,
      customerName: data.customer.name?.trim() ?? '',
      productCode,
      productName: data.product.name ?? '',
      amountCents: data.product.price ?? null,
    },
  }
}
```

Se o TypeScript reclamar do import de JSON no teste, adicionar `"resolveJsonModule": true` em `tsconfig.json` (o template do Next já costuma ter).

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m @'
feat: tradução de status e leitura do postback da Payt

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
```

---

### Task 4: Regra de acesso e montagem da vitrine

**Files:**
- Create: `src/lib/access/access.ts`
- Test: `tests/access/access.test.ts`

**Interfaces:**
- Consumes: `Material`, `OfferLink`, `OrderRef` (Task 2)
- Produces:
  - `grantedMaterialIds(orders: OrderRef[], links: OfferLink[], blocked: boolean): Set<string>`
  - `type VitrineItem = { id: string; title: string; description: string; coverUrl: string | null } & ({ unlocked: true; downloadUrl: string } | { unlocked: false; checkoutUrl: string | null })`
  - `buildVitrine(materials: Material[], granted: Set<string>): { unlocked: VitrineItem[]; locked: VitrineItem[] }`

- [ ] **Step 1: Testes que falham**

`tests/access/access.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildVitrine, grantedMaterialIds } from '@/lib/access/access'
import type { Material, OfferLink } from '@/lib/domain/types'

const links: OfferLink[] = [
  { productCode: 'BASICO', materialId: 'atlas' },
  { productCode: 'COMPLETO', materialId: 'atlas' },
  { productCode: 'COMPLETO', materialId: 'bonus1' },
  { productCode: 'COMPLETO', materialId: 'bonus2' },
  { productCode: 'BUMP', materialId: 'checklist' },
]

function material(id: string, sortOrder: number, extra: Partial<Material> = {}): Material {
  return {
    id, title: id, description: '', coverUrl: null,
    downloadUrl: `https://drive/${id}`, checkoutUrl: `https://payt/${id}`,
    sortOrder, isPublished: true, ...extra,
  }
}

describe('grantedMaterialIds', () => {
  it('libera os materiais das ofertas pagas', () => {
    const ids = grantedMaterialIds([{ productCode: 'COMPLETO', status: 'pago' }], links, false)
    expect([...ids].sort()).toEqual(['atlas', 'bonus1', 'bonus2'])
  })

  it('pedido pendente, cancelado, reembolsado ou chargeback não libera', () => {
    for (const status of ['pendente', 'cancelado', 'reembolsado', 'chargeback'] as const) {
      expect(grantedMaterialIds([{ productCode: 'BASICO', status }], links, false).size).toBe(0)
    }
  })

  it('reembolso de uma oferta mantém material liberado por outra', () => {
    const ids = grantedMaterialIds(
      [
        { productCode: 'BASICO', status: 'reembolsado' },
        { productCode: 'COMPLETO', status: 'pago' },
      ],
      links,
      false,
    )
    expect(ids.has('atlas')).toBe(true)
  })

  it('bump reembolsado com plano mantido remove só o bump', () => {
    const ids = grantedMaterialIds(
      [
        { productCode: 'BASICO', status: 'pago' },
        { productCode: 'BUMP', status: 'reembolsado' },
      ],
      links,
      false,
    )
    expect([...ids]).toEqual(['atlas'])
  })

  it('oferta desconhecida passa a liberar quando cadastrada', () => {
    const orders = [{ productCode: 'NOVO', status: 'pago' as const }]
    expect(grantedMaterialIds(orders, links, false).size).toBe(0)
    const withNew = [...links, { productCode: 'NOVO', materialId: 'pack' }]
    expect([...grantedMaterialIds(orders, withNew, false)]).toEqual(['pack'])
  })

  it('cliente bloqueado não tem acesso', () => {
    expect(grantedMaterialIds([{ productCode: 'COMPLETO', status: 'pago' }], links, true).size).toBe(0)
  })
})

describe('buildVitrine', () => {
  const materials = [material('bonus1', 2), material('atlas', 1), material('oculto', 0, { isPublished: false })]

  it('separa liberados e bloqueados, ordena e esconde não publicados', () => {
    const v = buildVitrine(materials, new Set(['atlas']))
    expect(v.unlocked.map((m) => m.id)).toEqual(['atlas'])
    expect(v.locked.map((m) => m.id)).toEqual(['bonus1'])
  })

  it('não expõe o link de download de material bloqueado', () => {
    const v = buildVitrine(materials, new Set())
    expect(JSON.stringify(v.locked)).not.toContain('https://drive/')
    expect(v.locked[0]).toMatchObject({ unlocked: false, checkoutUrl: 'https://payt/atlas' })
  })
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — `@/lib/access/access` não resolve

- [ ] **Step 3: Implementar**

`src/lib/access/access.ts`:
```ts
import type { Material, OfferLink, OrderRef } from '@/lib/domain/types'

export type VitrineItem = {
  id: string
  title: string
  description: string
  coverUrl: string | null
} & ({ unlocked: true; downloadUrl: string } | { unlocked: false; checkoutUrl: string | null })

export function grantedMaterialIds(orders: OrderRef[], links: OfferLink[], blocked: boolean): Set<string> {
  const granted = new Set<string>()
  if (blocked) return granted

  const paidCodes = new Set(orders.filter((o) => o.status === 'pago').map((o) => o.productCode))
  for (const link of links) {
    if (paidCodes.has(link.productCode)) granted.add(link.materialId)
  }
  return granted
}

export function buildVitrine(
  materials: Material[],
  granted: Set<string>,
): { unlocked: VitrineItem[]; locked: VitrineItem[] } {
  const visible = materials.filter((m) => m.isPublished).sort((a, b) => a.sortOrder - b.sortOrder)
  const unlocked: VitrineItem[] = []
  const locked: VitrineItem[] = []

  for (const m of visible) {
    const base = { id: m.id, title: m.title, description: m.description, coverUrl: m.coverUrl }
    if (granted.has(m.id)) unlocked.push({ ...base, unlocked: true, downloadUrl: m.downloadUrl })
    else locked.push({ ...base, unlocked: false, checkoutUrl: m.checkoutUrl })
  }
  return { unlocked, locked }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m @'
feat: regra de acesso calculada e vitrine

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
```

---

### Task 5: Processamento do postback

**Files:**
- Create: `src/lib/orders/process-postback.ts`, `tests/helpers/fakes.ts`
- Test: `tests/orders/process-postback.test.ts`

**Interfaces:**
- Consumes: `parsePaytPostback`, `mapPaytStatus`, `canTransition` (Task 3), `STATUS_RANK`, `OrderStatus`, `Store`, `CustomerRow` (Task 2)
- Produces:
```ts
export type ApplyOrderInput = {
  storeId: string; transactionId: string; productCode: string; productName: string
  customerEmail: string; customerName: string; status: OrderStatus
  paytType: string; isTest: boolean; amountCents: number | null
}
export type EventOutcome = 'unauthorized' | 'invalid' | 'ignored' | 'processed' | 'failed'
export interface PostbackRepo {
  logEvent(payload: unknown): Promise<string>
  finishEvent(id: string, result: { keyValid: boolean; outcome: EventOutcome; error?: string }): Promise<void>
  getStoreBySlug(slug: string): Promise<Store | null>
  applyOrderStatus(input: ApplyOrderInput): Promise<{ orderId: string; changed: boolean; status: OrderStatus }>
  findCustomerByEmail(email: string): Promise<CustomerRow | null>
  createCustomer(email: string, name: string): Promise<CustomerRow>
  getMaterialTitlesForProduct(storeId: string, productCode: string): Promise<string[]>
}
export type AccessEmail = { to: string; customerName: string; storeName: string; materialTitles: string[]; firstAccess: boolean }
export interface Mailer { sendAccessGranted(email: AccessEmail): Promise<void> }
export type ProcessResult =
  | { kind: 'unauthorized' }
  | { kind: 'invalid'; error: string }
  | { kind: 'ignored'; reason: string }
  | { kind: 'processed'; orderId: string; status: OrderStatus; changed: boolean; customerCreated: boolean; emailSent: boolean; emailError?: string }
export function processPostback(body: unknown, deps: { repo: PostbackRepo; mailer: Mailer; integrationKey: string; storeSlug: string }): Promise<ProcessResult>
```

- [ ] **Step 1: Fakes para os testes**

`tests/helpers/fakes.ts`:
```ts
import { STATUS_RANK, type CustomerRow, type OrderStatus, type Store } from '@/lib/domain/types'
import type { AccessEmail, ApplyOrderInput, EventOutcome, Mailer, PostbackRepo } from '@/lib/orders/process-postback'

type FakeOrder = ApplyOrderInput & { id: string }

export class FakeRepo implements PostbackRepo {
  store: Store = { id: 'store-1', slug: 'arquitetura', name: 'Arquitetura', logoUrl: null, primaryColor: '#000', supportUrl: null }
  events: { id: string; payload: unknown; keyValid?: boolean; outcome?: EventOutcome; error?: string }[] = []
  orders: FakeOrder[] = []
  customers: CustomerRow[] = []
  titles: Record<string, string[]> = { 'ATLAS-COMPLETO': ['Atlas Visual', 'Bônus 1'] }
  failCreateCustomerTimes = 0

  async logEvent(payload: unknown) {
    const id = `ev-${this.events.length + 1}`
    this.events.push({ id, payload })
    return id
  }
  async finishEvent(id: string, result: { keyValid: boolean; outcome: EventOutcome; error?: string }) {
    Object.assign(this.events.find((e) => e.id === id)!, result)
  }
  async getStoreBySlug(slug: string) {
    return slug === this.store.slug ? this.store : null
  }
  async applyOrderStatus(input: ApplyOrderInput) {
    const existing = this.orders.find(
      (o) => o.transactionId === input.transactionId && o.productCode === input.productCode,
    )
    if (!existing) {
      const order = { ...input, id: `ord-${this.orders.length + 1}` }
      this.orders.push(order)
      return { orderId: order.id, changed: true, status: order.status }
    }
    if (STATUS_RANK[input.status] > STATUS_RANK[existing.status]) {
      existing.status = input.status
      return { orderId: existing.id, changed: true, status: existing.status as OrderStatus }
    }
    return { orderId: existing.id, changed: false, status: existing.status as OrderStatus }
  }
  async findCustomerByEmail(email: string) {
    return this.customers.find((c) => c.email === email) ?? null
  }
  async createCustomer(email: string, name: string) {
    if (this.failCreateCustomerTimes > 0) {
      this.failCreateCustomerTimes--
      throw new Error('auth indisponível')
    }
    const customer = { id: `cus-${this.customers.length + 1}`, email, name, blockedAt: null }
    this.customers.push(customer)
    return customer
  }
  async getMaterialTitlesForProduct(_storeId: string, productCode: string) {
    return this.titles[productCode] ?? []
  }
}

export class FakeMailer implements Mailer {
  sent: AccessEmail[] = []
  fail = false
  async sendAccessGranted(email: AccessEmail) {
    if (this.fail) throw new Error('resend fora do ar')
    this.sent.push(email)
  }
}
```

- [ ] **Step 2: Testes que falham**

`tests/orders/process-postback.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { processPostback } from '@/lib/orders/process-postback'
import paid from '../fixtures/payt-paid.json'
import { FakeMailer, FakeRepo } from '../helpers/fakes'

const KEY = 'chave-de-teste'
let repo: FakeRepo
let mailer: FakeMailer

function run(body: unknown) {
  return processPostback(body, { repo, mailer, integrationKey: KEY, storeSlug: 'arquitetura' })
}
const withStatus = (status: string, extra: object = {}) => ({ ...paid, status, ...extra })

beforeEach(() => {
  repo = new FakeRepo()
  mailer = new FakeMailer()
})

describe('processPostback', () => {
  it('recusa chave de integração inválida e registra o evento', async () => {
    const result = await run({ ...paid, integration_key: 'errada' })
    expect(result).toEqual({ kind: 'unauthorized' })
    expect(repo.orders).toHaveLength(0)
    expect(repo.events[0]).toMatchObject({ keyValid: false, outcome: 'unauthorized' })
  })

  it('recusa payload sem chave', async () => {
    expect(await run({ status: 'paid' })).toEqual({ kind: 'unauthorized' })
  })

  it('compra paga de email novo cria cliente e envia primeiro acesso', async () => {
    const result = await run(paid)
    expect(result).toMatchObject({ kind: 'processed', status: 'pago', changed: true, customerCreated: true, emailSent: true })
    expect(repo.customers).toEqual([{ id: 'cus-1', email: 'joao@gmail.com', name: 'João Silva', blockedAt: null }])
    expect(mailer.sent).toEqual([
      { to: 'joao@gmail.com', customerName: 'João Silva', storeName: 'Arquitetura', materialTitles: ['Atlas Visual', 'Bônus 1'], firstAccess: true },
    ])
    expect(repo.events[0]).toMatchObject({ keyValid: true, outcome: 'processed' })
  })

  it('aviso repetido não duplica cliente nem email', async () => {
    await run(paid)
    const second = await run(paid)
    expect(second).toMatchObject({ kind: 'processed', changed: false, customerCreated: false, emailSent: false })
    expect(repo.customers).toHaveLength(1)
    expect(mailer.sent).toHaveLength(1)
  })

  it('aviso pendente atrasado não retrocede pedido pago', async () => {
    await run(paid)
    const late = await run(withStatus('waiting_payment'))
    expect(late).toMatchObject({ status: 'pago', changed: false })
    expect(mailer.sent).toHaveLength(1)
  })

  it('reembolso vale e pago atrasado não devolve acesso', async () => {
    await run(paid)
    expect(await run(withStatus('refunded'))).toMatchObject({ status: 'reembolsado', changed: true, emailSent: false })
    expect(await run(paid)).toMatchObject({ status: 'reembolsado', changed: false, emailSent: false })
    expect(mailer.sent).toHaveLength(1)
  })

  it('chargeback muda o status sem email', async () => {
    await run(paid)
    expect(await run(withStatus('chargeback'))).toMatchObject({ status: 'chargeback', emailSent: false })
  })

  it('cliente existente comprando outra oferta recebe email de novo material', async () => {
    await run(paid)
    await run({ ...paid, transaction_id: 'TX999', product: { name: 'Bump', code: 'BUMP' } })
    expect(mailer.sent[1]).toMatchObject({ firstAccess: false, materialTitles: [] })
    expect(repo.customers).toHaveLength(1)
  })

  it('pedido pendente de email novo não cria cliente', async () => {
    const result = await run(withStatus('waiting_payment'))
    expect(result).toMatchObject({ status: 'pendente', customerCreated: false, emailSent: false })
    expect(repo.customers).toHaveLength(0)
  })

  it('status irrelevante é ignorado sem criar pedido', async () => {
    expect(await run(withStatus('lost_cart'))).toEqual({ kind: 'ignored', reason: 'lost_cart' })
    expect(repo.orders).toHaveLength(0)
    expect(repo.events[0]).toMatchObject({ outcome: 'ignored' })
  })

  it('payload inválido com chave certa é registrado', async () => {
    const result = await run({ ...paid, customer: { name: 'X', email: 'x' } })
    expect(result.kind).toBe('invalid')
    expect(repo.events[0]).toMatchObject({ keyValid: true, outcome: 'invalid' })
  })

  it('falha no email não desfaz o pedido e fica registrada', async () => {
    mailer.fail = true
    const result = await run(paid)
    expect(result).toMatchObject({ kind: 'processed', status: 'pago', customerCreated: true, emailSent: false, emailError: 'resend fora do ar' })
    expect(repo.events[0]).toMatchObject({ outcome: 'processed', error: 'falha no email: resend fora do ar' })
  })

  it('se criar o cliente falhar, a nova tentativa cria e envia o email', async () => {
    repo.failCreateCustomerTimes = 1
    await expect(run(paid)).rejects.toThrow('auth indisponível')
    expect(repo.events[0]).toMatchObject({ outcome: 'failed', error: 'auth indisponível' })

    const retry = await run(paid)
    expect(retry).toMatchObject({ changed: false, customerCreated: true, emailSent: true })
    expect(mailer.sent).toHaveLength(1)
  })

  it('loja inexistente gera falha registrada', async () => {
    await expect(
      processPostback(paid, { repo, mailer, integrationKey: KEY, storeSlug: 'outra' }),
    ).rejects.toThrow('Loja não encontrada: outra')
    expect(repo.events[0]).toMatchObject({ outcome: 'failed' })
  })
})
```

- [ ] **Step 3: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — `@/lib/orders/process-postback` não resolve

- [ ] **Step 4: Implementar**

`src/lib/orders/process-postback.ts`:
```ts
import { timingSafeEqual } from 'node:crypto'
import type { CustomerRow, OrderStatus, Store } from '@/lib/domain/types'
import { parsePaytPostback } from '@/lib/payt/parse'
import { mapPaytStatus } from '@/lib/payt/status'

export type ApplyOrderInput = {
  storeId: string
  transactionId: string
  productCode: string
  productName: string
  customerEmail: string
  customerName: string
  status: OrderStatus
  paytType: string
  isTest: boolean
  amountCents: number | null
}

export type EventOutcome = 'unauthorized' | 'invalid' | 'ignored' | 'processed' | 'failed'

export interface PostbackRepo {
  logEvent(payload: unknown): Promise<string>
  finishEvent(id: string, result: { keyValid: boolean; outcome: EventOutcome; error?: string }): Promise<void>
  getStoreBySlug(slug: string): Promise<Store | null>
  applyOrderStatus(input: ApplyOrderInput): Promise<{ orderId: string; changed: boolean; status: OrderStatus }>
  findCustomerByEmail(email: string): Promise<CustomerRow | null>
  createCustomer(email: string, name: string): Promise<CustomerRow>
  getMaterialTitlesForProduct(storeId: string, productCode: string): Promise<string[]>
}

export type AccessEmail = {
  to: string
  customerName: string
  storeName: string
  materialTitles: string[]
  firstAccess: boolean
}

export interface Mailer {
  sendAccessGranted(email: AccessEmail): Promise<void>
}

export type ProcessResult =
  | { kind: 'unauthorized' }
  | { kind: 'invalid'; error: string }
  | { kind: 'ignored'; reason: string }
  | {
      kind: 'processed'
      orderId: string
      status: OrderStatus
      changed: boolean
      customerCreated: boolean
      emailSent: boolean
      emailError?: string
    }

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

function keyMatches(body: unknown, expected: string): boolean {
  const received =
    body && typeof body === 'object' && typeof (body as Record<string, unknown>).integration_key === 'string'
      ? ((body as Record<string, unknown>).integration_key as string)
      : ''
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function processPostback(
  body: unknown,
  deps: { repo: PostbackRepo; mailer: Mailer; integrationKey: string; storeSlug: string },
): Promise<ProcessResult> {
  const { repo, mailer } = deps
  const eventId = await repo.logEvent(body)

  if (!keyMatches(body, deps.integrationKey)) {
    await repo.finishEvent(eventId, { keyValid: false, outcome: 'unauthorized' })
    return { kind: 'unauthorized' }
  }

  const parsed = parsePaytPostback(body)
  if (!parsed.ok) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'invalid', error: parsed.error })
    return { kind: 'invalid', error: parsed.error }
  }
  const p = parsed.value

  const status = mapPaytStatus(p.status)
  if (!status) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'ignored', error: `status ignorado: ${p.status}` })
    return { kind: 'ignored', reason: p.status }
  }

  try {
    const store = await repo.getStoreBySlug(deps.storeSlug)
    if (!store) throw new Error(`Loja não encontrada: ${deps.storeSlug}`)

    const order = await repo.applyOrderStatus({
      storeId: store.id,
      transactionId: p.transactionId,
      productCode: p.productCode,
      productName: p.productName,
      customerEmail: p.customerEmail,
      customerName: p.customerName,
      status,
      paytType: p.type,
      isTest: p.isTest,
      amountCents: p.amountCents,
    })

    let customerCreated = false
    let emailSent = false
    let emailError: string | undefined

    if (order.status === 'pago') {
      const existing = await repo.findCustomerByEmail(p.customerEmail)
      if (!existing) {
        await repo.createCustomer(p.customerEmail, p.customerName)
        customerCreated = true
      }

      if (order.changed || customerCreated) {
        try {
          const materialTitles = await repo.getMaterialTitlesForProduct(store.id, p.productCode)
          await mailer.sendAccessGranted({
            to: p.customerEmail,
            customerName: p.customerName,
            storeName: store.name,
            materialTitles,
            firstAccess: customerCreated,
          })
          emailSent = true
        } catch (e) {
          emailError = errorMessage(e)
        }
      }
    }

    await repo.finishEvent(eventId, {
      keyValid: true,
      outcome: 'processed',
      error: emailError ? `falha no email: ${emailError}` : undefined,
    })

    return {
      kind: 'processed',
      orderId: order.orderId,
      status: order.status,
      changed: order.changed,
      customerCreated,
      emailSent,
      ...(emailError ? { emailError } : {}),
    }
  } catch (e) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'failed', error: errorMessage(e) })
    throw e
  }
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS (todos)

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m @'
feat: processamento idempotente do postback da Payt

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
```

---

### Task 6: Webhook real, emails e confirmação com aviso de teste da Payt

**Files:**
- Create: `src/lib/supabase/admin.ts`, `src/lib/data/stores.ts`, `src/lib/data/customers.ts`, `src/lib/data/orders.ts`, `src/lib/data/postback-repo.ts`, `src/lib/email/templates.ts`, `src/lib/email/resend-mailer.ts`, `src/app/api/webhooks/payt/route.ts`
- Test: `tests/email/templates.test.ts`
- Modify (após aviso real): `src/lib/payt/parse.ts`, `src/lib/payt/status.ts`, `tests/fixtures/payt-paid.json`, `tests/payt/*.test.ts`

**Interfaces:**
- Consumes: `PostbackRepo`, `Mailer`, `AccessEmail`, `processPostback` (Task 5); `env` (Task 1); tipos (Task 2)
- Produces:
  - `createAdminClient(): SupabaseClient`
  - `getStoreBySlug(slug: string): Promise<Store | null>`, `getDefaultStore(): Promise<Store>`
  - `findCustomerByEmail(email: string): Promise<CustomerRow | null>`, `createCustomer(email: string, name: string): Promise<CustomerRow>`
  - `getMaterialTitlesForProduct(storeId: string, productCode: string): Promise<string[]>`
  - `createPostbackRepo(): PostbackRepo`
  - `escapeHtml(value: string): string`, `accessGrantedEmail(input: AccessEmail & { loginUrl: string }): { subject: string; html: string }`
  - `createResendMailer(): Mailer`

- [ ] **Step 1: Testes do template (falham)**

`tests/email/templates.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { accessGrantedEmail, escapeHtml } from '@/lib/email/templates'

const base = {
  to: 'joao@gmail.com',
  customerName: 'João',
  storeName: 'Arquitetura',
  materialTitles: ['Atlas Visual', 'Bônus <1>'],
  loginUrl: 'https://app.test/entrar?email=joao%40gmail.com',
}

describe('accessGrantedEmail', () => {
  it('primeiro acesso', () => {
    const email = accessGrantedEmail({ ...base, firstAccess: true })
    expect(email.subject).toBe('Seu acesso chegou — Arquitetura')
    expect(email.html).toContain('Atlas Visual')
    expect(email.html).toContain('Bônus &lt;1&gt;')
    expect(email.html).toContain('href="https://app.test/entrar?email=joao%40gmail.com"')
    expect(email.html).toContain('Acessar meus materiais')
  })

  it('novo material', () => {
    expect(accessGrantedEmail({ ...base, firstAccess: false }).subject).toBe('Novo material liberado — Arquitetura')
  })

  it('funciona sem títulos e sem nome', () => {
    const email = accessGrantedEmail({ ...base, customerName: '', materialTitles: [], firstAccess: true })
    expect(email.html).toContain('Olá!')
    expect(email.html).not.toContain('<ul')
  })
})

describe('escapeHtml', () => {
  it('escapa caracteres especiais', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;')
  })
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — `@/lib/email/templates` não resolve

- [ ] **Step 3: Implementar templates**

`src/lib/email/templates.ts`:
```ts
import type { AccessEmail } from '@/lib/orders/process-postback'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function accessGrantedEmail(input: AccessEmail & { loginUrl: string }): { subject: string; html: string } {
  const store = escapeHtml(input.storeName)
  const subject = input.firstAccess
    ? `Seu acesso chegou — ${input.storeName}`
    : `Novo material liberado — ${input.storeName}`
  const greeting = input.customerName ? `Olá, ${escapeHtml(input.customerName.split(' ')[0])}!` : 'Olá!'
  const intro = input.firstAccess
    ? 'Sua compra foi confirmada e sua área de membros já está liberada.'
    : 'Um novo material foi liberado na sua área de membros.'
  const list = input.materialTitles.length
    ? `<ul style="padding-left:20px;margin:16px 0">${input.materialTitles
        .map((t) => `<li style="margin:4px 0">${escapeHtml(t)}</li>`)
        .join('')}</ul>`
    : ''

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
<p style="margin:0 0 8px;font-size:13px;color:#71717a">${store}</p>
<h1 style="margin:0 0 16px;font-size:22px">${greeting}</h1>
<p style="margin:0;font-size:16px;line-height:1.5">${intro}</p>
${list}
<p style="margin:24px 0"><a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold">Acessar meus materiais</a></p>
<p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">Para entrar, use este mesmo email: ${escapeHtml(input.to)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`

  return { subject, html }
}
```

Run: `npm test` → Expected: PASS

- [ ] **Step 4: Cliente admin do Supabase e acesso a dados**

`src/lib/supabase/admin.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

`src/lib/data/stores.ts`:
```ts
import type { Store } from '@/lib/domain/types'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const { data, error } = await createAdminClient()
    .from('stores')
    .select('id, slug, name, logo_url, primary_color, support_url')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
    supportUrl: data.support_url,
  }
}

export async function getDefaultStore(): Promise<Store> {
  const store = await getStoreBySlug(env.defaultStoreSlug)
  if (!store) throw new Error(`Loja não encontrada: ${env.defaultStoreSlug}`)
  return store
}
```

`src/lib/data/customers.ts`:
```ts
import type { CustomerRow } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

type DbCustomer = { id: string; email: string; name: string; blocked_at: string | null }

export function toCustomer(row: DbCustomer): CustomerRow {
  return { id: row.id, email: row.email, name: row.name, blockedAt: row.blocked_at }
}

export async function findCustomerByEmail(email: string): Promise<CustomerRow | null> {
  const { data, error } = await createAdminClient()
    .from('customers')
    .select('id, email, name, blocked_at')
    .eq('email', email)
    .maybeSingle()
  if (error) throw error
  return data ? toCustomer(data) : null
}

export async function createCustomer(email: string, name: string): Promise<CustomerRow> {
  const db = createAdminClient()

  let userId: string
  const created = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } })
  if (created.error) {
    const { data: existingId, error: rpcError } = await db.rpc('get_auth_user_id_by_email', { p_email: email })
    if (rpcError || !existingId) throw created.error
    userId = existingId as string
  } else {
    userId = created.data.user.id
  }

  const { error: upsertError } = await db
    .from('customers')
    .upsert({ id: userId, email, name }, { onConflict: 'id', ignoreDuplicates: true })
  if (upsertError) throw upsertError

  const { data, error } = await db.from('customers').select('id, email, name, blocked_at').eq('id', userId).single()
  if (error) throw error
  return toCustomer(data)
}
```

`src/lib/data/orders.ts`:
```ts
import { createAdminClient } from '@/lib/supabase/admin'

export async function getMaterialTitlesForProduct(storeId: string, productCode: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from('offers')
    .select('offer_materials(materials(title, sort_order))')
    .eq('store_id', storeId)
    .eq('payt_product_code', productCode)
    .maybeSingle()
  if (error) throw error
  if (!data) return []

  type Row = { materials: { title: string; sort_order: number } | null }
  return (data.offer_materials as unknown as Row[])
    .map((r) => r.materials)
    .filter((m): m is { title: string; sort_order: number } => m !== null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => m.title)
}
```

`src/lib/data/postback-repo.ts`:
```ts
import { STATUS_RANK, type OrderStatus } from '@/lib/domain/types'
import type { PostbackRepo } from '@/lib/orders/process-postback'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCustomer, findCustomerByEmail } from './customers'
import { getMaterialTitlesForProduct } from './orders'
import { getStoreBySlug } from './stores'

export function createPostbackRepo(): PostbackRepo {
  const db = createAdminClient()

  return {
    async logEvent(payload) {
      const { data, error } = await db.from('payt_events').insert({ payload }).select('id').single()
      if (error) throw error
      return data.id
    },

    async finishEvent(id, result) {
      const { error } = await db
        .from('payt_events')
        .update({
          key_valid: result.keyValid,
          outcome: result.outcome,
          error: result.error ?? null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },

    getStoreBySlug,

    async applyOrderStatus(input) {
      const { data, error } = await db
        .rpc('apply_order_status', {
          p_store_id: input.storeId,
          p_transaction_id: input.transactionId,
          p_product_code: input.productCode,
          p_product_name: input.productName,
          p_customer_email: input.customerEmail,
          p_customer_name: input.customerName,
          p_status: input.status,
          p_status_rank: STATUS_RANK[input.status],
          p_payt_type: input.paytType,
          p_is_test: input.isTest,
          p_amount_cents: input.amountCents,
        })
        .single()
      if (error) throw error
      const row = data as { out_order_id: string; out_changed: boolean; out_status: OrderStatus }
      return { orderId: row.out_order_id, changed: row.out_changed, status: row.out_status }
    },

    findCustomerByEmail,
    createCustomer,
    getMaterialTitlesForProduct,
  }
}
```

- [ ] **Step 5: Mailer e rota do webhook**

`src/lib/email/resend-mailer.ts`:
```ts
import { Resend } from 'resend'
import { env } from '@/lib/env'
import type { Mailer } from '@/lib/orders/process-postback'
import { accessGrantedEmail } from './templates'

export function createResendMailer(): Mailer {
  const resend = new Resend(env.resendApiKey)
  return {
    async sendAccessGranted(input) {
      const loginUrl = `${env.appUrl}/entrar?email=${encodeURIComponent(input.to)}`
      const { subject, html } = accessGrantedEmail({ ...input, loginUrl })
      const { error } = await resend.emails.send({ from: env.emailFrom, to: input.to, subject, html })
      if (error) throw new Error(error.message)
    },
  }
}
```

`src/app/api/webhooks/payt/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createPostbackRepo } from '@/lib/data/postback-repo'
import { createResendMailer } from '@/lib/email/resend-mailer'
import { env } from '@/lib/env'
import { processPostback } from '@/lib/orders/process-postback'

export async function POST(request: Request) {
  let body: unknown
  try {
    const contentType = request.headers.get('content-type') ?? ''
    body = contentType.includes('application/json')
      ? await request.json()
      : Object.fromEntries(new URLSearchParams(await request.text()))
  } catch {
    return NextResponse.json({ error: 'corpo inválido' }, { status: 400 })
  }

  try {
    const result = await processPostback(body, {
      repo: createPostbackRepo(),
      mailer: createResendMailer(),
      integrationKey: env.paytIntegrationKey,
      storeSlug: env.defaultStoreSlug,
    })
    if (result.kind === 'unauthorized') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
    if (result.kind === 'invalid') return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true, result: result.kind })
  } catch {
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Build, testes e commit**

Run: `npm test` → PASS · `npm run build` → sem erros

```powershell
git add -A
git commit -m @'
feat: webhook da Payt com Supabase e Resend

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
git push
```

- [ ] **Step 7: Variáveis na Vercel** (checkpoint com o dono do negócio)

Pedir ao usuário que cadastre na Vercel (Settings → Environment Variables, ambientes Production e Preview) todas as variáveis de `.env.local`, com `APP_URL` = URL `*.vercel.app`. Até a Task 12: `EMAIL_FROM=onboarding@resend.dev` (o Resend só entrega para o email dono da conta Resend). Redeploy e confirmar `READY` com `mcp__claude_ai_Vercel__list_deployments`.

- [ ] **Step 8: Aviso de teste real da Payt** (checkpoint com o dono do negócio)

Pedir ao usuário que, no painel da Payt, configure o postback para `https://<app>.vercel.app/api/webhooks/payt` com os eventos **Finalizada/Aprovada, Cancelada, Cancelada - Reembolsada, Cancelada - Chargeback, Aguardando pagamento**, e dispare um teste de cada evento disponível, usando o **próprio email da conta Resend** como comprador.

Ler os avisos:
```sql
select received_at, key_valid, outcome, error, payload
from public.payt_events order by received_at desc limit 20;
```

- [ ] **Step 9: Ajustar ao formato real**

Com os payloads reais:
1. Se o corpo chegou como form-urlencoded com chaves tipo `customer[email]`, trocar o parse do corpo na rota por um conversor de chaves aninhadas e adicionar teste.
2. Se `status` de reembolso/chargeback tiver outros textos, atualizar `PAYT_STATUS` em `src/lib/payt/status.ts` e `tests/payt/status.test.ts`.
3. Se o código do produto ou o valor estiverem em outros campos, ajustar `schema` em `src/lib/payt/parse.ts`.
4. Se um aviso trouxer **vários produtos** (lista), mudar `parsePaytPostback` para retornar uma lista e `processPostback` para aplicar cada item; adicionar teste "bump e plano no mesmo aviso criam dois pedidos".
5. Substituir `tests/fixtures/payt-paid.json` por um payload real **anonimizado** (nome, email, CPF, telefone e endereço trocados; `integration_key` = `chave-de-teste`).

Run: `npm test` → PASS. Commit `fix: formato real do postback da Payt` e push.

- [ ] **Step 10: Reprocessar e verificar**

Disparar de novo o teste "Finalizada/Aprovada" na Payt. Verificar com SQL: 1 linha em `orders` com `status = 'pago'`, 1 linha em `customers`, `payt_events.outcome = 'processed'` sem `error`, e o email "Seu acesso chegou" na caixa de entrada do dono. Disparar "Reembolsada" e verificar `status = 'reembolsado'`.

---

### Task 7: Sessão e login do cliente só com email

**Files:**
- Create: `src/lib/auth/admin.ts`, `src/lib/auth/customer-login.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`, `src/proxy.ts`, `src/app/entrar/page.tsx`, `src/app/entrar/form.tsx`, `src/app/entrar/actions.ts`, `src/app/sair/route.ts`
- Modify: `src/lib/data/customers.ts` (adicionar funções)
- Test: `tests/auth/customer-login.test.ts`

**Interfaces:**
- Consumes: `normalizeEmail`, `isValidEmail` (Task 1); `CustomerRow` (Task 2); `findCustomerByEmail` (Task 6); `env`
- Produces:
  - `isAdminEmail(email: string, adminEmails: string[]): boolean`
  - `LOGIN_ATTEMPT_LIMIT = 20`
  - `type LoginFailure = 'invalid_email' | 'admin_email' | 'not_found' | 'blocked' | 'rate_limited'`
  - `type LoginDecision = { ok: true; email: string; customerId: string } | { ok: false; reason: LoginFailure }`
  - `decideCustomerLogin(input: { email: string; ip: string }, deps: { adminEmails: string[]; countRecentAttempts(ip: string): Promise<number>; recordAttempt(ip: string): Promise<void>; findCustomerByEmail(email: string): Promise<CustomerRow | null> }): Promise<LoginDecision>`
  - `createClient(): Promise<SupabaseClient>` (em `src/lib/supabase/server.ts`)
  - `countRecentLoginAttempts(ip: string): Promise<number>`, `recordLoginAttempt(ip: string): Promise<void>`, `recordDevice(customerId: string, userAgent: string, ip: string): Promise<void>`

- [ ] **Step 1: Testes que falham**

`tests/auth/customer-login.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isAdminEmail } from '@/lib/auth/admin'
import { decideCustomerLogin, LOGIN_ATTEMPT_LIMIT } from '@/lib/auth/customer-login'
import type { CustomerRow } from '@/lib/domain/types'

function deps(overrides: { attempts?: number; customers?: CustomerRow[] } = {}) {
  const recorded: string[] = []
  const customers = overrides.customers ?? [{ id: 'c1', email: 'joao@gmail.com', name: 'João', blockedAt: null }]
  return {
    recorded,
    deps: {
      adminEmails: ['dono@gmail.com'],
      countRecentAttempts: async () => overrides.attempts ?? 0,
      recordAttempt: async (ip: string) => { recorded.push(ip) },
      findCustomerByEmail: async (email: string) => customers.find((c) => c.email === email) ?? null,
    },
  }
}

describe('decideCustomerLogin', () => {
  it('entra com email de cliente, normalizando', async () => {
    const { deps: d, recorded } = deps()
    expect(await decideCustomerLogin({ email: ' JOAO@gmail.com ', ip: '1.1.1.1' }, d)).toEqual({
      ok: true, email: 'joao@gmail.com', customerId: 'c1',
    })
    expect(recorded).toEqual(['1.1.1.1'])
  })

  it('recusa email inválido', async () => {
    expect(await decideCustomerLogin({ email: 'joao', ip: 'x' }, deps().deps)).toEqual({ ok: false, reason: 'invalid_email' })
  })

  it('recusa email de admin', async () => {
    expect(await decideCustomerLogin({ email: 'Dono@gmail.com', ip: 'x' }, deps().deps)).toEqual({ ok: false, reason: 'admin_email' })
  })

  it('recusa email sem compras', async () => {
    expect(await decideCustomerLogin({ email: 'maria@gmail.com', ip: 'x' }, deps().deps)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('recusa cliente bloqueado', async () => {
    const d = deps({ customers: [{ id: 'c1', email: 'joao@gmail.com', name: '', blockedAt: '2026-09-16T00:00:00Z' }] }).deps
    expect(await decideCustomerLogin({ email: 'joao@gmail.com', ip: 'x' }, d)).toEqual({ ok: false, reason: 'blocked' })
  })

  it('bloqueia após o limite de tentativas sem registrar nova', async () => {
    const { deps: d, recorded } = deps({ attempts: LOGIN_ATTEMPT_LIMIT })
    expect(await decideCustomerLogin({ email: 'joao@gmail.com', ip: 'x' }, d)).toEqual({ ok: false, reason: 'rate_limited' })
    expect(recorded).toEqual([])
  })
})

describe('isAdminEmail', () => {
  it('compara normalizado', () => {
    expect(isAdminEmail(' DONO@gmail.com', ['dono@gmail.com'])).toBe(true)
    expect(isAdminEmail('joao@gmail.com', ['dono@gmail.com'])).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — `@/lib/auth/admin` e `@/lib/auth/customer-login` não resolvem

- [ ] **Step 3: Implementar a decisão**

`src/lib/auth/admin.ts`:
```ts
import { normalizeEmail } from '@/lib/domain/email'

export function isAdminEmail(email: string, adminEmails: string[]): boolean {
  return adminEmails.includes(normalizeEmail(email))
}
```

`src/lib/auth/customer-login.ts`:
```ts
import { isAdminEmail } from '@/lib/auth/admin'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'
import type { CustomerRow } from '@/lib/domain/types'

export const LOGIN_ATTEMPT_LIMIT = 20

export type LoginFailure = 'invalid_email' | 'admin_email' | 'not_found' | 'blocked' | 'rate_limited'

export type LoginDecision = { ok: true; email: string; customerId: string } | { ok: false; reason: LoginFailure }

export async function decideCustomerLogin(
  input: { email: string; ip: string },
  deps: {
    adminEmails: string[]
    countRecentAttempts(ip: string): Promise<number>
    recordAttempt(ip: string): Promise<void>
    findCustomerByEmail(email: string): Promise<CustomerRow | null>
  },
): Promise<LoginDecision> {
  if ((await deps.countRecentAttempts(input.ip)) >= LOGIN_ATTEMPT_LIMIT) return { ok: false, reason: 'rate_limited' }
  await deps.recordAttempt(input.ip)

  const email = normalizeEmail(input.email)
  if (!isValidEmail(email)) return { ok: false, reason: 'invalid_email' }
  if (isAdminEmail(email, deps.adminEmails)) return { ok: false, reason: 'admin_email' }

  const customer = await deps.findCustomerByEmail(email)
  if (!customer) return { ok: false, reason: 'not_found' }
  if (customer.blockedAt) return { ok: false, reason: 'blocked' }

  return { ok: true, email, customerId: customer.id }
}
```

Run: `npm test` → Expected: PASS

- [ ] **Step 4: Funções de dados de login**

Adicionar ao final de `src/lib/data/customers.ts`:
```ts
import { createHash } from 'node:crypto'

const LOGIN_WINDOW_MINUTES = 15

export async function countRecentLoginAttempts(ip: string): Promise<number> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString()
  const { count, error } = await createAdminClient()
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', since)
  if (error) throw error
  return count ?? 0
}

export async function recordLoginAttempt(ip: string): Promise<void> {
  const { error } = await createAdminClient().from('login_attempts').insert({ ip })
  if (error) throw error
}

export async function recordDevice(customerId: string, userAgent: string, ip: string): Promise<void> {
  const deviceHash = createHash('sha256').update(`${userAgent}|${ip}`).digest('hex')
  const { error } = await createAdminClient()
    .from('customer_devices')
    .upsert(
      { customer_id: customerId, device_hash: deviceHash, user_agent: userAgent, last_seen_at: new Date().toISOString() },
      { onConflict: 'customer_id,device_hash' },
    )
  if (error) throw error
}
```
Mover o `import { createHash } from 'node:crypto'` para o topo do arquivo, junto dos outros imports.

- [ ] **Step 5: Clientes Supabase de sessão e proxy**

`src/lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado a partir de Server Component: o proxy renova a sessão.
        }
      },
    },
  })
}
```

`src/lib/supabase/proxy.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims)
  const path = request.nextUrl.pathname

  const needsCustomer = path === '/'
  const needsAdmin = path.startsWith('/admin') && !path.startsWith('/admin/entrar')

  if (!signedIn && (needsCustomer || needsAdmin)) {
    const url = request.nextUrl.clone()
    url.pathname = needsAdmin ? '/admin/entrar' : '/entrar'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
```

`src/proxy.ts`:
```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 6: Tela e ação de login**

`src/app/entrar/actions.ts`:
```ts
'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { decideCustomerLogin, type LoginFailure } from '@/lib/auth/customer-login'
import { countRecentLoginAttempts, findCustomerByEmail, recordDevice, recordLoginAttempt } from '@/lib/data/customers'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type EntrarState = { error: string | null; email: string }

const MESSAGES: Record<LoginFailure, string> = {
  invalid_email: 'Digite um email válido.',
  admin_email: 'Este email é de administrador. Entre por /admin/entrar.',
  not_found: 'Não encontramos compras com este email. Confira se é o mesmo email usado na compra.',
  blocked: 'Este acesso está suspenso. Fale com o suporte.',
  rate_limited: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
}

const GENERIC_ERROR = 'Não foi possível entrar agora. Tente novamente em instantes.'

export async function entrar(_prev: EntrarState, formData: FormData): Promise<EntrarState> {
  const email = String(formData.get('email') ?? '')
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido'
  const userAgent = h.get('user-agent') ?? ''

  const decision = await decideCustomerLogin(
    { email, ip },
    {
      adminEmails: env.adminEmails,
      countRecentAttempts: countRecentLoginAttempts,
      recordAttempt: recordLoginAttempt,
      findCustomerByEmail,
    },
  )
  if (!decision.ok) return { error: MESSAGES[decision.reason], email }

  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: 'magiclink',
    email: decision.email,
  })
  if (error) return { error: GENERIC_ERROR, email }

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: data.properties.hashed_token,
  })
  if (verifyError) return { error: GENERIC_ERROR, email }

  await recordDevice(decision.customerId, userAgent, ip)
  redirect('/')
}
```

`src/app/entrar/form.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { entrar, type EntrarState } from './actions'

export function EntrarForm({ initialEmail, supportUrl }: { initialEmail: string; supportUrl: string | null }) {
  const [state, action, pending] = useActionState<EntrarState, FormData>(entrar, { error: null, email: initialEmail })

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Email usado na compra
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-900"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
          {supportUrl && (
            <>
              {' '}
              <a href={supportUrl} className="underline">Falar com o suporte</a>
            </>
          )}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
```

`src/app/entrar/page.tsx`:
```tsx
import { getDefaultStore } from '@/lib/data/stores'
import { EntrarForm } from './form'

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = '' } = await searchParams
  const store = await getDefaultStore()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm text-zinc-500">{store.name}</p>
        <h1 className="mb-6 mt-1 text-2xl font-bold">Acesse seus materiais</h1>
        <EntrarForm initialEmail={email} supportUrl={store.supportUrl} />
      </div>
    </main>
  )
}
```

`src/app/sair/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const target = new URL(request.url).searchParams.get('para') === 'admin' ? '/admin/entrar' : '/entrar'
  return NextResponse.redirect(new URL(target, request.url), { status: 303 })
}
```

- [ ] **Step 7: Página temporária para verificar sessão**

Substituir `src/app/page.tsx` por:
```tsx
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return <main className="p-6">Logado como {data.user?.email}</main>
}
```

- [ ] **Step 8: Verificar no navegador**

Run: `npm run dev`. Com Playwright (`mcp__plugin_playwright_playwright__browser_navigate` para `http://localhost:3000/`):
1. `/` redireciona para `/entrar`.
2. Email inexistente → mensagem "Não encontramos compras…".
3. Email do cliente criado na Task 6 → vai para `/` mostrando "Logado como …".
4. Email de `ADMIN_EMAILS` → mensagem de administrador.

Se o passo 3 falhar com erro de token em `verifyOtp`, trocar `type: 'email'` por `type: 'magiclink'` e repetir.

Run: `npm test` → PASS · `npm run build` → sem erros

- [ ] **Step 9: Commit**

```powershell
git add -A
git commit -m @'
feat: login do cliente somente com email

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
```

---

### Task 8: Vitrine

**Files:**
- Create: `src/lib/data/access.ts`, `src/app/vitrine/locked-card.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`
- Modify: `src/lib/data/catalog.ts` (criar com as funções abaixo)

**Interfaces:**
- Consumes: `grantedMaterialIds`, `buildVitrine`, `VitrineItem` (Task 4); `getDefaultStore` (Task 6); `findCustomerByEmail`; `createClient`
- Produces:
  - `listMaterials(storeId: string): Promise<Material[]>`
  - `getOfferLinks(storeId: string): Promise<OfferLink[]>`
  - `listOrderRefsByEmail(storeId: string, email: string): Promise<OrderRef[]>`
  - `loadCustomerAccess(storeId: string, email: string): Promise<{ customer: CustomerRow | null; materials: Material[]; granted: Set<string> }>`

- [ ] **Step 1: Leitura de catálogo e acesso**

`src/lib/data/catalog.ts`:
```ts
import type { Material, OfferLink } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

type DbMaterial = {
  id: string
  title: string
  description: string
  cover_url: string | null
  download_url: string
  checkout_url: string | null
  sort_order: number
  is_published: boolean
}

const MATERIAL_COLUMNS = 'id, title, description, cover_url, download_url, checkout_url, sort_order, is_published'

export function toMaterial(row: DbMaterial): Material {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    downloadUrl: row.download_url,
    checkoutUrl: row.checkout_url,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  }
}

export async function listMaterials(storeId: string): Promise<Material[]> {
  const { data, error } = await createAdminClient()
    .from('materials')
    .select(MATERIAL_COLUMNS)
    .eq('store_id', storeId)
    .order('sort_order')
  if (error) throw error
  return data.map(toMaterial)
}

export async function getOfferLinks(storeId: string): Promise<OfferLink[]> {
  const { data, error } = await createAdminClient()
    .from('offers')
    .select('payt_product_code, offer_materials(material_id)')
    .eq('store_id', storeId)
  if (error) throw error
  return data.flatMap((offer) =>
    (offer.offer_materials as { material_id: string }[]).map((m) => ({
      productCode: offer.payt_product_code,
      materialId: m.material_id,
    })),
  )
}
```

Adicionar em `src/lib/data/orders.ts`:
```ts
import type { OrderRef, OrderStatus } from '@/lib/domain/types'

export async function listOrderRefsByEmail(storeId: string, email: string): Promise<OrderRef[]> {
  const { data, error } = await createAdminClient()
    .from('orders')
    .select('payt_product_code, status')
    .eq('store_id', storeId)
    .eq('customer_email', email)
  if (error) throw error
  return data.map((o) => ({ productCode: o.payt_product_code, status: o.status as OrderStatus }))
}
```
(mantendo os imports no topo do arquivo)

`src/lib/data/access.ts`:
```ts
import { grantedMaterialIds } from '@/lib/access/access'
import type { CustomerRow, Material } from '@/lib/domain/types'
import { getOfferLinks, listMaterials } from './catalog'
import { findCustomerByEmail } from './customers'
import { listOrderRefsByEmail } from './orders'

export async function loadCustomerAccess(
  storeId: string,
  email: string,
): Promise<{ customer: CustomerRow | null; materials: Material[]; granted: Set<string> }> {
  const [customer, materials, links, orders] = await Promise.all([
    findCustomerByEmail(email),
    listMaterials(storeId),
    getOfferLinks(storeId),
    listOrderRefsByEmail(storeId, email),
  ])
  const granted = grantedMaterialIds(orders, links, !customer || customer.blockedAt !== null)
  return { customer, materials, granted }
}
```

- [ ] **Step 2: Direção visual** (checkpoint com o dono do negócio)

Invocar o skill `frontend-design:frontend-design` para definir fontes, cores e estilo dos cards para um público de arquitetos (capas verticais tipo livro técnico). Aplicar a direção ao código dos Steps 3–4 **mantendo a estrutura, os textos e o comportamento** abaixo. Tirar screenshots em 375px e 1280px com Playwright e mostrar ao usuário antes de seguir.

- [ ] **Step 3: Card bloqueado**

`src/app/vitrine/locked-card.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { VitrineItem } from '@/lib/access/access'

type LockedItem = Extract<VitrineItem, { unlocked: false }>

export function LockedCard({ item }: { item: LockedItem }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left"
      >
        <div className="relative aspect-[3/4] bg-zinc-100">
          {item.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.coverUrl} alt="" className="h-full w-full object-cover opacity-40 grayscale" />
          )}
          <span className="absolute inset-0 flex items-center justify-center text-3xl" aria-hidden>🔒</span>
        </div>
        <div className="p-3">
          <h3 className="text-sm font-semibold text-zinc-500">{item.title}</h3>
        </div>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`locked-${item.id}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={`locked-${item.id}`} className="text-xl font-bold">{item.title}</h2>
            {item.description && <p className="mt-3 whitespace-pre-line text-zinc-600">{item.description}</p>}
            <div className="mt-6 flex flex-col gap-2">
              {item.checkoutUrl && (
                <a
                  href={item.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-zinc-900 px-4 py-3 text-center font-semibold text-white"
                >
                  Quero acessar
                </a>
              )}
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-3 text-zinc-600">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Página da vitrine**

`src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { buildVitrine } from '@/lib/access/access'
import { loadCustomerAccess } from '@/lib/data/access'
import { getDefaultStore } from '@/lib/data/stores'
import { createClient } from '@/lib/supabase/server'
import { LockedCard } from './vitrine/locked-card'

export const dynamic = 'force-dynamic'

export default async function VitrinePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user?.email) redirect('/entrar')

  const store = await getDefaultStore()
  const { customer, materials, granted } = await loadCustomerAccess(store.id, data.user.email)

  if (!customer || customer.blockedAt) {
    await supabase.auth.signOut()
    redirect('/entrar')
  }

  const vitrine = buildVitrine(materials, granted)

  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {store.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="h-8 w-auto" />
            )}
            <span className="font-semibold">{store.name}</span>
          </div>
          <form action="/sair" method="post">
            <button type="submit" className="text-sm text-zinc-600">Sair</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section>
          <h2 className="mb-4 text-lg font-bold">Seus materiais</h2>
          {vitrine.unlocked.length === 0 ? (
            <p className="text-zinc-600">Seus materiais aparecem aqui assim que o pagamento for confirmado.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {vitrine.unlocked.map((item) =>
                item.unlocked ? (
                  <li key={item.id} className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
                    <div className="aspect-[3/4] bg-zinc-100">
                      {item.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-3">
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <a
                        href={item.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto rounded-lg bg-zinc-900 px-3 py-2 text-center text-sm font-semibold text-white"
                      >
                        Baixar
                      </a>
                    </div>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </section>

        {vitrine.locked.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-bold">Desbloqueie mais</h2>
            <ul className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {vitrine.locked.map((item) =>
                item.unlocked ? null : (
                  <li key={item.id} className="flex">
                    <LockedCard item={item} />
                  </li>
                ),
              )}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
```

Em `src/app/layout.tsx`: `<html lang="pt-BR">` e `metadata = { title: 'Área de Membros', description: 'Seus materiais' }`.

- [ ] **Step 5: Verificar**

Cadastrar via `execute_sql` dados de verificação: 2 materiais publicados (Atlas e Bônus 1, com `checkout_url`), 1 oferta com o `payt_product_code` do pedido de teste da Task 6 ligada só ao Atlas. Com Playwright em 375px e 1280px: Atlas aparece em "Seus materiais" com Baixar; Bônus 1 aparece com cadeado e o painel mostra "Quero acessar"; o HTML da página não contém o `download_url` do Bônus 1. Mudar o pedido para `reembolsado` via SQL e recarregar: Atlas passa para bloqueados. Voltar o pedido para `pago` e remover os dados de verificação no fim.

Run: `npm test` → PASS · `npm run build` → sem erros

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m @'
feat: vitrine com materiais liberados e bloqueados

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
```

---

### Task 9: Login do admin com código

**Files:**
- Create: `src/lib/auth/require-admin.ts`, `src/app/admin/entrar/page.tsx`, `src/app/admin/entrar/form.tsx`, `src/app/admin/entrar/actions.ts`, `src/app/admin/(painel)/layout.tsx`, `src/app/admin/(painel)/page.tsx`

**Interfaces:**
- Consumes: `isAdminEmail` (Task 7), `createClient`, `env`
- Produces: `requireAdmin(): Promise<{ email: string }>` (redireciona para `/admin/entrar` se não for admin)

- [ ] **Step 1: Template do email de código no Supabase** (checkpoint com o dono do negócio)

Pedir ao usuário que, no painel Supabase → Authentication → Email Templates → **Magic Link**, troque o corpo por:
```html
<h2>Código de acesso ao admin</h2>
<p>Seu código: <strong style="font-size:24px">{{ .Token }}</strong></p>
<p>Ele expira em alguns minutos. Se não foi você, ignore este email.</p>
```
Assunto: `Seu código de acesso`. Até a Task 12, o SMTP padrão do Supabase só entrega para membros da organização, o que inclui o email do dono.

- [ ] **Step 2: Guard**

`src/lib/auth/require-admin.ts`:
```ts
import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/auth/admin'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export async function requireAdmin(): Promise<{ email: string }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email
  if (!email || !isAdminEmail(email, env.adminEmails)) redirect('/admin/entrar')
  return { email }
}
```

- [ ] **Step 3: Ações de login do admin**

`src/app/admin/entrar/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/auth/admin'
import { normalizeEmail } from '@/lib/domain/email'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export type AdminLoginState = { step: 'email' | 'code'; email: string; error: string | null }

export async function enviarCodigo(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''))
  if (!isAdminEmail(email, env.adminEmails)) return { step: 'email', email, error: 'Email não autorizado.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) return { step: 'email', email, error: 'Não foi possível enviar o código. Tente novamente.' }
  return { step: 'code', email, error: null }
}

export async function verificarCodigo(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''))
  const token = String(formData.get('token') ?? '').replace(/\D/g, '')
  if (!isAdminEmail(email, env.adminEmails)) return { step: 'email', email, error: 'Email não autorizado.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) return { step: 'code', email, error: 'Código inválido ou expirado.' }
  redirect('/admin')
}
```

`src/app/admin/entrar/form.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { enviarCodigo, verificarCodigo, type AdminLoginState } from './actions'

const initial: AdminLoginState = { step: 'email', email: '', error: null }
const input = 'rounded-lg border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-900'
const button = 'rounded-lg bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-60'

export function AdminLoginForm() {
  const [sent, send, sending] = useActionState(enviarCodigo, initial)
  const [verified, verify, verifying] = useActionState(verificarCodigo, initial)

  if (sent.step === 'code') {
    return (
      <form action={verify} className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600">Enviamos um código para {sent.email}.</p>
        <input type="hidden" name="email" value={sent.email} />
        <input name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className={input} placeholder="000000" />
        {verified.error && <p role="alert" className="text-sm text-red-700">{verified.error}</p>}
        <button type="submit" disabled={verifying} className={button}>{verifying ? 'Verificando…' : 'Entrar'}</button>
      </form>
    )
  }

  return (
    <form action={send} className="flex flex-col gap-4">
      <input name="email" type="email" required defaultValue={sent.email} className={input} placeholder="seu@email.com" />
      {sent.error && <p role="alert" className="text-sm text-red-700">{sent.error}</p>}
      <button type="submit" disabled={sending} className={button}>{sending ? 'Enviando…' : 'Enviar código'}</button>
    </form>
  )
}
```

`src/app/admin/entrar/page.tsx`:
```tsx
import { AdminLoginForm } from './form'

export default function AdminEntrarPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-bold">Admin</h1>
        <AdminLoginForm />
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Layout do painel**

`src/app/admin/(painel)/layout.tsx`:
```tsx
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'

export const dynamic = 'force-dynamic'

const links = [
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/materiais', label: 'Materiais' },
  { href: '/admin/ofertas', label: 'Ofertas' },
]

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin()
  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-bold">Admin</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-zinc-700 hover:text-zinc-950">{l.label}</Link>
            ))}
          </nav>
          <form action="/sair?para=admin" method="post" className="ml-auto flex items-center gap-3 text-sm text-zinc-500">
            <span className="hidden sm:inline">{email}</span>
            <button type="submit">Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
```

`src/app/admin/(painel)/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function AdminHome() {
  redirect('/admin/pedidos')
}
```

- [ ] **Step 5: Verificar**

Com `npm run dev`: `/admin` sem sessão → `/admin/entrar`; email fora de `ADMIN_EMAILS` → "Email não autorizado."; email do dono → código chega → entra em `/admin/pedidos` (404 por enquanto é esperado). Sessão de cliente (Task 7) acessando `/admin` → volta para `/admin/entrar`.

Run: `npm run build` → sem erros

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m @'
feat: login do admin com código por email

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
```

---

### Task 10: Admin — materiais e ofertas

**Files:**
- Modify: `src/lib/data/catalog.ts`
- Modify: `next.config.ts`
- Create: `src/app/admin/(painel)/materiais/page.tsx`, `src/app/admin/(painel)/materiais/[id]/page.tsx`, `src/app/admin/(painel)/materiais/material-form.tsx`, `src/app/admin/(painel)/materiais/actions.ts`, `src/app/admin/(painel)/ofertas/page.tsx`, `src/app/admin/(painel)/ofertas/[id]/page.tsx`, `src/app/admin/(painel)/ofertas/offer-form.tsx`, `src/app/admin/(painel)/ofertas/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin` (Task 9), `getDefaultStore`, `listMaterials`, `toMaterial` (Task 8)
- Produces:
  - `getMaterial(id: string): Promise<Material | null>`
  - `type MaterialInput = { id: string | null; storeId: string; title: string; description: string; coverUrl: string | null; downloadUrl: string; checkoutUrl: string | null; sortOrder: number; isPublished: boolean }`
  - `saveMaterial(input: MaterialInput): Promise<void>`
  - `uploadCover(file: File): Promise<string>`
  - `type Offer = { id: string; name: string; paytProductCode: string; materialIds: string[] }`
  - `listOffers(storeId: string): Promise<Offer[]>`, `getOffer(id: string): Promise<Offer | null>`
  - `saveOffer(input: { id: string | null; storeId: string; name: string; paytProductCode: string; materialIds: string[] }): Promise<void>`

- [ ] **Step 1: Funções de catálogo**

Adicionar em `src/lib/data/catalog.ts`:
```ts
export async function getMaterial(id: string): Promise<Material | null> {
  const { data, error } = await createAdminClient().from('materials').select(MATERIAL_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toMaterial(data) : null
}

export type MaterialInput = {
  id: string | null
  storeId: string
  title: string
  description: string
  coverUrl: string | null
  downloadUrl: string
  checkoutUrl: string | null
  sortOrder: number
  isPublished: boolean
}

export async function saveMaterial(input: MaterialInput): Promise<void> {
  const row = {
    store_id: input.storeId,
    title: input.title,
    description: input.description,
    cover_url: input.coverUrl,
    download_url: input.downloadUrl,
    checkout_url: input.checkoutUrl,
    sort_order: input.sortOrder,
    is_published: input.isPublished,
    updated_at: new Date().toISOString(),
  }
  const db = createAdminClient()
  const { error } = input.id
    ? await db.from('materials').update(row).eq('id', input.id)
    : await db.from('materials').insert(row)
  if (error) throw error
}

export async function uploadCover(file: File): Promise<string> {
  const db = createAdminClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await db.storage.from('covers').upload(path, file, { contentType: file.type })
  if (error) throw error
  return db.storage.from('covers').getPublicUrl(path).data.publicUrl
}

export type Offer = { id: string; name: string; paytProductCode: string; materialIds: string[] }

type DbOffer = { id: string; name: string; payt_product_code: string; offer_materials: { material_id: string }[] }

function toOffer(row: DbOffer): Offer {
  return {
    id: row.id,
    name: row.name,
    paytProductCode: row.payt_product_code,
    materialIds: row.offer_materials.map((m) => m.material_id),
  }
}

const OFFER_COLUMNS = 'id, name, payt_product_code, offer_materials(material_id)'

export async function listOffers(storeId: string): Promise<Offer[]> {
  const { data, error } = await createAdminClient().from('offers').select(OFFER_COLUMNS).eq('store_id', storeId).order('name')
  if (error) throw error
  return (data as DbOffer[]).map(toOffer)
}

export async function getOffer(id: string): Promise<Offer | null> {
  const { data, error } = await createAdminClient().from('offers').select(OFFER_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toOffer(data as DbOffer) : null
}

export async function saveOffer(input: {
  id: string | null
  storeId: string
  name: string
  paytProductCode: string
  materialIds: string[]
}): Promise<void> {
  const db = createAdminClient()
  const row = { store_id: input.storeId, name: input.name, payt_product_code: input.paytProductCode }

  let offerId = input.id
  if (offerId) {
    const { error } = await db.from('offers').update(row).eq('id', offerId)
    if (error) throw error
  } else {
    const { data, error } = await db.from('offers').insert(row).select('id').single()
    if (error) throw error
    offerId = data.id as string
  }

  const { error: deleteError } = await db.from('offer_materials').delete().eq('offer_id', offerId)
  if (deleteError) throw deleteError
  if (input.materialIds.length) {
    const { error: insertError } = await db
      .from('offer_materials')
      .insert(input.materialIds.map((materialId) => ({ offer_id: offerId, material_id: materialId })))
    if (insertError) throw insertError
  }
}
```

`next.config.ts` — dentro do objeto de configuração:
```ts
experimental: {
  serverActions: { bodySizeLimit: '5mb' },
},
```

- [ ] **Step 2: Materiais**

`src/app/admin/(painel)/materiais/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { saveMaterial, uploadCover } from '@/lib/data/catalog'
import { getDefaultStore } from '@/lib/data/stores'

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim()
}

export async function salvarMaterial(formData: FormData) {
  await requireAdmin()
  const store = await getDefaultStore()

  let coverUrl = text(formData, 'cover_url') || null
  const cover = formData.get('cover')
  if (cover instanceof File && cover.size > 0) coverUrl = await uploadCover(cover)

  await saveMaterial({
    id: text(formData, 'id') || null,
    storeId: store.id,
    title: text(formData, 'title'),
    description: text(formData, 'description'),
    coverUrl,
    downloadUrl: text(formData, 'download_url'),
    checkoutUrl: text(formData, 'checkout_url') || null,
    sortOrder: Number(text(formData, 'sort_order') || 0),
    isPublished: formData.get('is_published') === 'on',
  })

  revalidatePath('/admin/materiais')
  revalidatePath('/')
  redirect('/admin/materiais')
}
```

`src/app/admin/(painel)/materiais/material-form.tsx`:
```tsx
import type { Material } from '@/lib/domain/types'
import { salvarMaterial } from './actions'

const field = 'flex flex-col gap-1 text-sm font-medium'
const input = 'rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal'

export function MaterialForm({ material }: { material: Material | null }) {
  return (
    <form action={salvarMaterial} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="id" value={material?.id ?? ''} />
      <input type="hidden" name="cover_url" value={material?.coverUrl ?? ''} />
      <label className={field}>Título<input name="title" required defaultValue={material?.title} className={input} /></label>
      <label className={field}>Descrição (aparece no card bloqueado)<textarea name="description" rows={4} defaultValue={material?.description} className={input} /></label>
      <label className={field}>Link de download (Drive ou direto)<input name="download_url" type="url" required defaultValue={material?.downloadUrl} className={input} /></label>
      <label className={field}>Link do checkout (botão &quot;Quero acessar&quot;)<input name="checkout_url" type="url" defaultValue={material?.checkoutUrl ?? ''} className={input} /></label>
      <label className={field}>
        Capa (imagem vertical)
        {material?.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={material.coverUrl} alt="" className="h-32 w-24 rounded object-cover" />
        )}
        <input name="cover" type="file" accept="image/*" className="text-sm font-normal" />
      </label>
      <label className={field}>Ordem<input name="sort_order" type="number" defaultValue={material?.sortOrder ?? 0} className={input} /></label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input name="is_published" type="checkbox" defaultChecked={material?.isPublished ?? false} /> Publicado
      </label>
      <button type="submit" className="self-start rounded-lg bg-zinc-900 px-4 py-2 font-semibold text-white">Salvar</button>
    </form>
  )
}
```

`src/app/admin/(painel)/materiais/page.tsx`:
```tsx
import Link from 'next/link'
import { listMaterials } from '@/lib/data/catalog'
import { getDefaultStore } from '@/lib/data/stores'

export default async function MateriaisPage() {
  const store = await getDefaultStore()
  const materials = await listMaterials(store.id)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Materiais</h1>
        <Link href="/admin/materiais/novo" className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">Novo material</Link>
      </div>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {materials.map((m) => (
          <li key={m.id}>
            <Link href={`/admin/materiais/${m.id}`} className="flex items-center justify-between gap-4 px-4 py-3">
              <span>{m.sortOrder}. {m.title}</span>
              <span className={m.isPublished ? 'text-sm text-green-700' : 'text-sm text-zinc-400'}>
                {m.isPublished ? 'Publicado' : 'Oculto'}
              </span>
            </Link>
          </li>
        ))}
        {materials.length === 0 && <li className="px-4 py-3 text-zinc-500">Nenhum material cadastrado.</li>}
      </ul>
    </div>
  )
}
```

`src/app/admin/(painel)/materiais/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getMaterial } from '@/lib/data/catalog'
import { MaterialForm } from '../material-form'

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const material = id === 'novo' ? null : await getMaterial(id)
  if (id !== 'novo' && !material) notFound()

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{material ? 'Editar material' : 'Novo material'}</h1>
      <MaterialForm material={material} />
    </div>
  )
}
```

- [ ] **Step 3: Ofertas**

`src/app/admin/(painel)/ofertas/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { saveOffer } from '@/lib/data/catalog'
import { getDefaultStore } from '@/lib/data/stores'

export async function salvarOferta(formData: FormData) {
  await requireAdmin()
  const store = await getDefaultStore()

  await saveOffer({
    id: String(formData.get('id') ?? '') || null,
    storeId: store.id,
    name: String(formData.get('name') ?? '').trim(),
    paytProductCode: String(formData.get('payt_product_code') ?? '').trim(),
    materialIds: formData.getAll('material_ids').map(String),
  })

  revalidatePath('/admin/ofertas')
  revalidatePath('/')
  redirect('/admin/ofertas')
}
```

`src/app/admin/(painel)/ofertas/offer-form.tsx`:
```tsx
import type { Offer } from '@/lib/data/catalog'
import type { Material } from '@/lib/domain/types'
import { salvarOferta } from './actions'

const field = 'flex flex-col gap-1 text-sm font-medium'
const input = 'rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal'

export function OfferForm({ offer, materials }: { offer: Offer | null; materials: Material[] }) {
  return (
    <form action={salvarOferta} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="id" value={offer?.id ?? ''} />
      <label className={field}>Nome (ex.: Plano Completo)<input name="name" required defaultValue={offer?.name} className={input} /></label>
      <label className={field}>Código do produto na Payt<input name="payt_product_code" required defaultValue={offer?.paytProductCode} className={input} /></label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Materiais liberados</legend>
        {materials.map((m) => (
          <label key={m.id} className="flex items-center gap-2">
            <input type="checkbox" name="material_ids" value={m.id} defaultChecked={offer?.materialIds.includes(m.id)} />
            {m.title}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="self-start rounded-lg bg-zinc-900 px-4 py-2 font-semibold text-white">Salvar</button>
    </form>
  )
}
```

`src/app/admin/(painel)/ofertas/page.tsx`:
```tsx
import Link from 'next/link'
import { listMaterials, listOffers } from '@/lib/data/catalog'
import { getDefaultStore } from '@/lib/data/stores'

export default async function OfertasPage() {
  const store = await getDefaultStore()
  const [offers, materials] = await Promise.all([listOffers(store.id), listMaterials(store.id)])
  const titles = new Map(materials.map((m) => [m.id, m.title]))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Ofertas</h1>
        <Link href="/admin/ofertas/novo" className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">Nova oferta</Link>
      </div>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {offers.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/ofertas/${o.id}`} className="block px-4 py-3">
              <span className="font-medium">{o.name}</span>{' '}
              <span className="text-sm text-zinc-500">({o.paytProductCode})</span>
              <span className="block text-sm text-zinc-600">
                {o.materialIds.map((id) => titles.get(id)).filter(Boolean).join(' · ') || 'Nenhum material'}
              </span>
            </Link>
          </li>
        ))}
        {offers.length === 0 && <li className="px-4 py-3 text-zinc-500">Nenhuma oferta cadastrada.</li>}
      </ul>
    </div>
  )
}
```

`src/app/admin/(painel)/ofertas/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getOffer, listMaterials } from '@/lib/data/catalog'
import { getDefaultStore } from '@/lib/data/stores'
import { OfferForm } from '../offer-form'

export default async function OfertaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const store = await getDefaultStore()
  const [offer, materials] = await Promise.all([id === 'novo' ? null : getOffer(id), listMaterials(store.id)])
  if (id !== 'novo' && !offer) notFound()

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{offer ? 'Editar oferta' : 'Nova oferta'}</h1>
      <OfferForm offer={offer} materials={materials} />
    </div>
  )
}
```

- [ ] **Step 4: Verificar**

Com Playwright logado como admin: criar material com capa (upload) e link; criar oferta com o código do pedido de teste marcando o material; logar como o cliente de teste em outra aba e ver o material liberado. Editar a oferta desmarcando o material → recarregar a vitrine → material bloqueado. Remover os dados de verificação.

Run: `npm test` → PASS · `npm run build` → sem erros

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m @'
feat: admin de materiais e ofertas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
```

---

### Task 11: Admin — pedidos e clientes

**Files:**
- Modify: `src/lib/data/orders.ts`, `src/lib/data/customers.ts`
- Create: `src/app/admin/(painel)/pedidos/page.tsx`, `src/app/admin/(painel)/clientes/page.tsx`, `src/app/admin/(painel)/clientes/[id]/page.tsx`, `src/app/admin/(painel)/clientes/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `getDefaultStore`, `listOffers` (Task 10), `loadCustomerAccess` (Task 8), `createResendMailer`, `toCustomer`, `normalizeEmail`, `isValidEmail`
- Produces:
  - `type AdminOrder = { id: string; createdAt: string; customerEmail: string; productCode: string; productName: string; status: OrderStatus; isTest: boolean; amountCents: number | null }`
  - `type OrderFilter = 'todos' | 'problemas' | 'desconhecidas' | 'teste'`
  - `listOrders(storeId: string, filter: OrderFilter): Promise<AdminOrder[]>`
  - `listOrdersByEmail(email: string): Promise<AdminOrder[]>`
  - `SHARING_DEVICE_THRESHOLD = 4`
  - `type CustomerSummary = CustomerRow & { recentDevices: number }`
  - `searchCustomers(query: string): Promise<CustomerSummary[]>`
  - `getCustomer(id: string): Promise<CustomerRow | null>`
  - `listDevices(customerId: string): Promise<{ userAgent: string; firstSeenAt: string; lastSeenAt: string }[]>`
  - `setCustomerBlocked(id: string, blocked: boolean): Promise<void>`
  - `changeCustomerEmail(id: string, newEmail: string): Promise<void>`

- [ ] **Step 1: Dados de pedidos**

Adicionar em `src/lib/data/orders.ts`:
```ts
export type AdminOrder = {
  id: string
  createdAt: string
  customerEmail: string
  productCode: string
  productName: string
  status: OrderStatus
  isTest: boolean
  amountCents: number | null
}

export type OrderFilter = 'todos' | 'problemas' | 'desconhecidas' | 'teste'

const ORDER_COLUMNS = 'id, created_at, customer_email, payt_product_code, payt_product_name, status, is_test, amount_cents'

type DbOrder = {
  id: string
  created_at: string
  customer_email: string
  payt_product_code: string
  payt_product_name: string
  status: string
  is_test: boolean
  amount_cents: number | null
}

function toAdminOrder(o: DbOrder): AdminOrder {
  return {
    id: o.id,
    createdAt: o.created_at,
    customerEmail: o.customer_email,
    productCode: o.payt_product_code,
    productName: o.payt_product_name,
    status: o.status as OrderStatus,
    isTest: o.is_test,
    amountCents: o.amount_cents,
  }
}

export async function listOrders(storeId: string, filter: OrderFilter): Promise<AdminOrder[]> {
  const db = createAdminClient()
  let query = db.from('orders').select(ORDER_COLUMNS).eq('store_id', storeId).order('created_at', { ascending: false }).limit(200)
  if (filter === 'problemas') query = query.in('status', ['reembolsado', 'chargeback'])
  if (filter === 'teste') query = query.eq('is_test', true)
  const { data, error } = await query
  if (error) throw error
  const orders = (data as DbOrder[]).map(toAdminOrder)

  if (filter !== 'desconhecidas') return orders
  const { data: offers, error: offersError } = await db.from('offers').select('payt_product_code').eq('store_id', storeId)
  if (offersError) throw offersError
  const known = new Set(offers.map((o) => o.payt_product_code))
  return orders.filter((o) => !known.has(o.productCode))
}

export async function listOrdersByEmail(email: string): Promise<AdminOrder[]> {
  const { data, error } = await createAdminClient()
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('customer_email', email)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as DbOrder[]).map(toAdminOrder)
}
```

- [ ] **Step 2: Dados de clientes**

Adicionar em `src/lib/data/customers.ts`:
```ts
export const SHARING_DEVICE_THRESHOLD = 4
const DEVICE_WINDOW_DAYS = 30

export type CustomerSummary = CustomerRow & { recentDevices: number }

export async function searchCustomers(query: string): Promise<CustomerSummary[]> {
  const db = createAdminClient()
  let request = db.from('customers').select('id, email, name, blocked_at').order('created_at', { ascending: false }).limit(50)
  if (query) request = request.ilike('email', `%${query.replace(/[%_]/g, '')}%`)
  const { data, error } = await request
  if (error) throw error
  const customers = (data as DbCustomer[]).map(toCustomer)
  if (customers.length === 0) return []

  const since = new Date(Date.now() - DEVICE_WINDOW_DAYS * 86_400_000).toISOString()
  const { data: devices, error: devicesError } = await db
    .from('customer_devices')
    .select('customer_id')
    .in('customer_id', customers.map((c) => c.id))
    .gte('last_seen_at', since)
  if (devicesError) throw devicesError

  const counts = new Map<string, number>()
  for (const d of devices) counts.set(d.customer_id, (counts.get(d.customer_id) ?? 0) + 1)
  return customers.map((c) => ({ ...c, recentDevices: counts.get(c.id) ?? 0 }))
}

export async function getCustomer(id: string): Promise<CustomerRow | null> {
  const { data, error } = await createAdminClient().from('customers').select('id, email, name, blocked_at').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toCustomer(data) : null
}

export async function listDevices(customerId: string) {
  const { data, error } = await createAdminClient()
    .from('customer_devices')
    .select('user_agent, first_seen_at, last_seen_at')
    .eq('customer_id', customerId)
    .order('last_seen_at', { ascending: false })
  if (error) throw error
  return data.map((d) => ({ userAgent: d.user_agent, firstSeenAt: d.first_seen_at, lastSeenAt: d.last_seen_at }))
}

export async function setCustomerBlocked(id: string, blocked: boolean): Promise<void> {
  const { error } = await createAdminClient()
    .from('customers')
    .update({ blocked_at: blocked ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function changeCustomerEmail(id: string, newEmail: string): Promise<void> {
  const db = createAdminClient()
  const current = await getCustomer(id)
  if (!current) throw new Error('Cliente não encontrado')
  if (current.email === newEmail) return
  if (await findCustomerByEmail(newEmail)) throw new Error('Já existe um cliente com este email')

  const { error: authError } = await db.auth.admin.updateUserById(id, { email: newEmail, email_confirm: true })
  if (authError) throw authError
  const { error: customerError } = await db.from('customers').update({ email: newEmail }).eq('id', id)
  if (customerError) throw customerError
  const { error: ordersError } = await db.from('orders').update({ customer_email: newEmail }).eq('customer_email', current.email)
  if (ordersError) throw ordersError
}
```

- [ ] **Step 3: Página de pedidos**

`src/app/admin/(painel)/pedidos/page.tsx`:
```tsx
import Link from 'next/link'
import { listOrders, type OrderFilter } from '@/lib/data/orders'
import { getDefaultStore } from '@/lib/data/stores'

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'problemas', label: 'Reembolsos e chargebacks' },
  { value: 'desconhecidas', label: 'Oferta não cadastrada' },
  { value: 'teste', label: 'Teste' },
]

const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-zinc-100 text-zinc-700',
  pago: 'bg-green-100 text-green-800',
  cancelado: 'bg-zinc-200 text-zinc-700',
  reembolsado: 'bg-amber-100 text-amber-800',
  chargeback: 'bg-red-100 text-red-800',
}

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams
  const filter = FILTERS.some((f) => f.value === filtro) ? (filtro as OrderFilter) : 'todos'
  const store = await getDefaultStore()
  const orders = await listOrders(store.id, filter)

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Pedidos</h1>
      <nav className="mb-4 flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/pedidos?filtro=${f.value}`}
            className={`rounded-full px-3 py-1 ${f.value === filter ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-200'}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Produto</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="whitespace-nowrap px-4 py-2">{new Date(o.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                <td className="px-4 py-2">
                  <Link href={`/admin/clientes?q=${encodeURIComponent(o.customerEmail)}`} className="underline">{o.customerEmail}</Link>
                </td>
                <td className="px-4 py-2">
                  {o.productName || o.productCode} <span className="text-zinc-400">({o.productCode})</span>
                  {o.isTest && <span className="ml-2 text-xs text-zinc-500">teste</span>}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}>{o.status}</span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-3 text-zinc-500">Nenhum pedido.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Ações de cliente**

`src/app/admin/(painel)/clientes/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadCustomerAccess } from '@/lib/data/access'
import { changeCustomerEmail, getCustomer, setCustomerBlocked } from '@/lib/data/customers'
import { getDefaultStore } from '@/lib/data/stores'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'
import { createResendMailer } from '@/lib/email/resend-mailer'

function back(id: string, message: string): never {
  revalidatePath(`/admin/clientes/${id}`)
  redirect(`/admin/clientes/${id}?msg=${encodeURIComponent(message)}`)
}

export async function alternarBloqueio(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  const block = formData.get('block') === 'true'
  await setCustomerBlocked(id, block)
  back(id, block ? 'Cliente bloqueado.' : 'Cliente desbloqueado.')
}

export async function corrigirEmail(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  const email = normalizeEmail(String(formData.get('email') ?? ''))
  if (!isValidEmail(email)) back(id, 'Email inválido.')
  try {
    await changeCustomerEmail(id, email)
  } catch (e) {
    back(id, e instanceof Error ? e.message : 'Não foi possível alterar o email.')
  }
  back(id, 'Email alterado.')
}

export async function reenviarAcesso(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  const customer = await getCustomer(id)
  if (!customer) back(id, 'Cliente não encontrado.')

  const store = await getDefaultStore()
  const { materials, granted } = await loadCustomerAccess(store.id, customer.email)
  const materialTitles = materials.filter((m) => granted.has(m.id)).map((m) => m.title)

  try {
    await createResendMailer().sendAccessGranted({
      to: customer.email,
      customerName: customer.name,
      storeName: store.name,
      materialTitles,
      firstAccess: true,
    })
  } catch (e) {
    back(id, `Falha ao enviar: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
  }
  back(id, 'Email de acesso reenviado.')
}
```

- [ ] **Step 5: Páginas de clientes**

`src/app/admin/(painel)/clientes/page.tsx`:
```tsx
import Link from 'next/link'
import { SHARING_DEVICE_THRESHOLD, searchCustomers } from '@/lib/data/customers'

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams
  const customers = await searchCustomers(q.trim().toLowerCase())

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Clientes</h1>
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por email" className="w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2" />
        <button type="submit" className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">Buscar</button>
      </form>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/clientes/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>{c.email} <span className="text-sm text-zinc-500">{c.name}</span></span>
              <span className="flex gap-2 text-xs">
                {c.recentDevices >= SHARING_DEVICE_THRESHOLD && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{c.recentDevices} aparelhos</span>
                )}
                {c.blockedAt && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">bloqueado</span>}
              </span>
            </Link>
          </li>
        ))}
        {customers.length === 0 && <li className="px-4 py-3 text-zinc-500">Nenhum cliente encontrado.</li>}
      </ul>
    </div>
  )
}
```

`src/app/admin/(painel)/clientes/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getCustomer, listDevices } from '@/lib/data/customers'
import { listOrdersByEmail } from '@/lib/data/orders'
import { alternarBloqueio, corrigirEmail, reenviarAcesso } from '../actions'

const button = 'rounded-lg px-3 py-2 text-sm font-semibold'

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ msg?: string }>
}) {
  const [{ id }, { msg }] = await Promise.all([params, searchParams])
  const customer = await getCustomer(id)
  if (!customer) notFound()
  const [orders, devices] = await Promise.all([listOrdersByEmail(customer.email), listDevices(id)])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">{customer.email}</h1>
        <p className="text-zinc-600">{customer.name}</p>
        {msg && <p role="status" className="mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm">{msg}</p>}
      </div>

      <section className="flex flex-wrap gap-2">
        <form action={reenviarAcesso}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={`${button} bg-zinc-900 text-white`}>Reenviar acesso</button>
        </form>
        <form action={alternarBloqueio}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="block" value={customer.blockedAt ? 'false' : 'true'} />
          <button type="submit" className={`${button} ${customer.blockedAt ? 'bg-white ring-1 ring-zinc-300' : 'bg-red-600 text-white'}`}>
            {customer.blockedAt ? 'Desbloquear' : 'Bloquear'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Corrigir email</h2>
        <form action={corrigirEmail} className="flex flex-wrap gap-2">
          <input type="hidden" name="id" value={id} />
          <input name="email" type="email" required defaultValue={customer.email} className="w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2" />
          <button type="submit" className={`${button} bg-white ring-1 ring-zinc-300`}>Salvar email</button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Pedidos</h2>
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
              <span>{o.productName || o.productCode} <span className="text-zinc-400">({o.productCode})</span></span>
              <span>{o.status}</span>
            </li>
          ))}
          {orders.length === 0 && <li className="px-4 py-2 text-zinc-500">Nenhum pedido.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Aparelhos ({devices.length})</h2>
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white text-sm">
          {devices.map((d) => (
            <li key={`${d.userAgent}-${d.firstSeenAt}`} className="px-4 py-2">
              <span className="block truncate">{d.userAgent || 'Desconhecido'}</span>
              <span className="text-zinc-500">
                Último acesso: {new Date(d.lastSeenAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </span>
            </li>
          ))}
          {devices.length === 0 && <li className="px-4 py-2 text-zinc-500">Nenhum acesso registrado.</li>}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 6: Verificar**

Com Playwright logado como admin: filtros de pedidos funcionam (reembolso de teste aparece em "Reembolsos e chargebacks"; pedido com código sem oferta aparece em "Oferta não cadastrada"); bloquear o cliente de teste → login do cliente mostra "acesso suspenso" e uma sessão já aberta é deslogada ao recarregar `/`; desbloquear; "Reenviar acesso" entrega o email (para o dono da conta Resend); corrigir email para outro e voltar ao original.

Run: `npm test` → PASS · `npm run build` → sem erros

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m @'
feat: admin de pedidos e clientes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
'@
git push
```

---

### Task 12: Domínio, emails de produção e postback definitivo

**Files:** nenhum código. Configuração em serviços externos.

- [ ] **Step 1: Comprar domínio** (checkpoint com o dono do negócio)

Perguntar o nome desejado. `mcp__claude_ai_Vercel__check_domain_availability_and_price` → mostrar preço → **só com confirmação explícita** usar `mcp__claude_ai_Vercel__get_purchase_quote` e `mcp__claude_ai_Vercel__buy_domain`.

- [ ] **Step 2: Verificar domínio no Resend** (checkpoint com o dono do negócio)

Pedir ao usuário que adicione o domínio em resend.com/domains e informe os registros DNS exibidos. Criar esses registros no DNS da Vercel (painel Vercel → Domains → DNS Records, ou pedir ao usuário). Aguardar status **Verified** no Resend.

- [ ] **Step 3: Variáveis de produção**

Na Vercel: `EMAIL_FROM` = `<Nome da loja> <acesso@dominio.com>`. Redeploy e confirmar `READY`.

- [ ] **Step 4: SMTP do Supabase** (checkpoint com o dono do negócio)

Supabase → Authentication → SMTP Settings: host `smtp.resend.com`, porta `465`, usuário `resend`, senha = `RESEND_API_KEY`, remetente `acesso@dominio.com`. Supabase → Authentication → URL Configuration: Site URL = `APP_URL`.

- [ ] **Step 5: Planos pagos** (checkpoint com o dono do negócio)

Lembrar o usuário de ativar Vercel Pro e Supabase Pro antes de vender (spec §3).

- [ ] **Step 6: Verificar**

Disparar o aviso de teste "Finalizada/Aprovada" na Payt com um email **diferente** do dono (ex.: Gmail pessoal secundário). Expected: email "Seu acesso chegou" chega na caixa de entrada (não spam), com remetente do domínio. Login admin com código continua funcionando.

---

### Task 13: Teste ponta a ponta antes de vender

**Files:** nenhum código (correções geram commits próprios).

- [ ] **Step 1: Cadastrar o catálogo real** (checkpoint com o dono do negócio)

Com o usuário: materiais (Atlas, Bônus 1, 2 e 3, bumps e upsells) com capas, links e checkouts; ofertas (Plano Básico, Plano Completo, cada bump e upsell) com os códigos exatos da Payt.

- [ ] **Step 2: Compra real de baixo valor**

Usuário cria na Payt uma oferta de teste de valor mínimo que libera o Atlas, compra pelo celular com Pix usando um email próprio. Verificar: email chega → botão abre `/entrar` com email preenchido → entra → Atlas em "Seus materiais" → Baixar abre o link → bônus aparecem com cadeado → "Quero acessar" abre o checkout.

- [ ] **Step 3: Compra adicional**

Mesmo email compra um bump/upsell de teste. Verificar email "Novo material liberado" e material liberado sem novo cadastro.

- [ ] **Step 4: Reembolso**

Usuário reembolsa a compra na Payt. Verificar `payt_events` com `outcome = 'processed'`, pedido `reembolsado`, material volta a ficar bloqueado na vitrine e o pedido aparece no filtro "Reembolsos e chargebacks".

- [ ] **Step 5: Computador**

Repetir login e vitrine em navegador de computador (1280px) e conferir layout.

- [ ] **Step 6: Registrar**

Anotar no final da spec (§12) a data do teste ponta a ponta e qualquer ajuste feito. Commit `docs: teste ponta a ponta concluído`.
