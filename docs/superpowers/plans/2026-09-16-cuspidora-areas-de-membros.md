# Cuspidora de Áreas de Membros — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a área de membros do Atlas numa plataforma multi-loja com visual Netflix fixo, Payt liberando bumps, registro/reenvio de e-mails, login protegido, PWA e sucesso do cliente.

**Architecture:** Next.js 16 (App Router) na Vercel, com todas as leituras e escritas no servidor via cliente Supabase de serviço (RLS ligado, sem políticas públicas). Lojas identificadas pelo primeiro segmento do caminho (`/[loja]`). Acesso continua calculado a partir de pedidos pagos. A migração do banco é **aditiva** (Task 1) para o app seguir compilando a cada tarefa; tabelas e código antigos saem só na Task 12.

**Tech Stack:** Next.js 16.3.5, React 19.2.8, TypeScript, Tailwind CSS v4, Supabase (`@supabase/supabase-js` 2.116, `@supabase/ssr` 0.12), Resend 6, Zod 4, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-16-cuspidora-areas-de-membros-design.md`

## Global Constraints

- Next.js 16 **não é o Next que você conhece**: antes de usar uma API do Next, leia o guia em `node_modules/next/dist/docs/`. `params` e `searchParams` são `Promise`. O arquivo de interceptação é `src/proxy.ts` (não `middleware.ts`). `PageProps<'/rota'>` e `LayoutProps<'/rota'>` são tipos globais gerados.
- Nunca chamar `setState` de forma síncrona dentro de `useEffect` (regra `react-hooks/set-state-in-effect` do lint). Use `useSyncExternalStore` ou handlers de evento.
- Cores só por tokens do tema (`bg-fundo`, `text-texto`, `bg-destaque`…). Cor literal permitida apenas em HTML de e-mail, `ImageResponse`, manifesto e `public/offline.html`.
- Textos de interface em português do Brasil; escrever "e-mail" nas telas novas.
- Todo acesso ao banco pelo `createAdminClient()` no servidor. Nenhum dado de cliente, URL de item ou chave vai para componente de cliente sem necessidade.
- Testes: Vitest em `tests/**/*.test.ts`, ambiente node, alias `@` → `src`. Comandos: `npm test`, `npm run lint`, `npm run build`.
- Links de itens (`items.url`) nunca aparecem no HTML da vitrine nem da página do produto; só são usados no redirecionamento de `/[loja]/item/[id]`.
- Slugs reservados de loja: `admin`, `api`, `entrar`, `sair`, `_next`, `favicon.ico`, `manifest.webmanifest`, `sw.js`, `icons`. Formato de slug: `^[a-z0-9]+(-[a-z0-9]+)*$`.
- Código da Payt (`offers.payt_product_code`) é único no sistema inteiro.
- Remetente: `"{nome da loja}" <endereço de EMAIL_FROM>`; limite diário `EMAIL_DAILY_LIMIT` (padrão 100).
- Login: armadilha `website`, carimbo assinado com tempo mínimo de 1,5 s, 20 tentativas por IP e 5 por e-mail em 10 min, atraso progressivo a partir da 3ª tentativa, Turnstile só quando `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` existem.
- **Não commitar** `docs/relatorio-*.md` (são de outro contexto). Nunca imprimir valores de `.env.local`.
- Commits em português, formato `feat:`/`fix:`/`chore:`/`docs:`. Commits feitos por agentes Claude terminam com a linha `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`; commits do Codex não levam essa linha.

## Execução em paralelo

| Frente | Quem executa | Tarefas (em ordem) | Pasta de trabalho |
|---|---|---|---|
| Base | Claude (sessão principal, com MCP Supabase) | Task 1 | `main` |
| A — backend | Codex (`codex exec` na worktree) | Task 2 → Task 3 → Task 4 | `..\worktrees-area-de-membros\frente-a` (branch `frente-a`) |
| B — área do cliente | Subagente Claude | Task 5 → Task 6 → Task 7 → Task 8 | `..\worktrees-area-de-membros\frente-b` (branch `frente-b`) |
| C — admin | Subagente Claude | Task 9 → Task 10 → Task 11 | `..\worktrees-area-de-membros\frente-c` (branch `frente-c`) |
| Final | Claude (sessão principal) | Task 12 | `main` |

As worktrees ficam **fora** da pasta do repositório (pasta irmã `worktrees-area-de-membros`), para não entrarem no `tsconfig` nem no lint da pasta principal. Preparação de cada uma (PowerShell, a partir da pasta do repositório):

```powershell
git worktree add "..\worktrees-area-de-membros\frente-a" -b frente-a main
Copy-Item .env.local "..\worktrees-area-de-membros\frente-a\.env.local"
Push-Location "..\worktrees-area-de-membros\frente-a"; npm ci; npm test; Pop-Location
```

Regras de coordenação:

1. Task 1 é concluída, revisada e está em `main` antes de criar as worktrees.
2. Cada tarefa termina com testes, lint e build passando e um commit na branch da frente. A sessão principal revisa (spec + código) e faz `git merge --no-ff` em `main`.
3. Antes de começar uma tarefa, a frente faz `git merge main` para receber o que já entrou.
4. Dependências entre frentes: **Task 9** só começa com a Task 5 em `main`; **Task 10** exige Tasks 2 e 3 em `main`; **Task 11** exige Tasks 4 e 6 em `main`.
5. Cada frente só edita os arquivos listados na própria tarefa. Se precisar de outro arquivo, para e avisa a sessão principal.

Comando do Codex (PowerShell), um por tarefa:

```powershell
$exe = "$env:USERPROFILE\.codex\plugins\.plugin-appserver\codex.exe"
& $exe exec -s workspace-write -C "C:\Users\arqal\OneDrive\Desktop\Ideias Low Ticket\worktrees-area-de-membros\frente-a" --color never -o "$env:TEMP\codex-task-N.txt" "Leia docs/superpowers/plans/2026-09-16-cuspidora-areas-de-membros.md e a spec citada no topo. Execute SOMENTE a Task N, passo a passo, com TDD. Não use rg (use Select-String). Ao final rode npm test, npm run lint e npm run build, faça o commit descrito na tarefa e responda com o resumo e a saída dos testes."
```

---

### Task 1: Banco aditivo, tipos, dados de produtos e regra de acesso por produto

**Executor:** Claude (sessão principal) — precisa do MCP Supabase (projeto `tujtwlrxpetpiatlbrps`).

**Files:**
- Create: `supabase/migrations/20260917000001_cuspidora_base.sql`
- Create: `src/lib/data/products.ts`
- Create: `tests/access/shelf.test.ts`
- Modify: `src/lib/domain/types.ts` (arquivo inteiro)
- Modify: `src/lib/access/access.ts` (acrescentar ao final)
- Modify: `src/lib/data/stores.ts` (arquivo inteiro)
- Modify: `src/lib/data/orders.ts` (acrescentar função)
- Modify: `src/lib/data/access.ts` (acrescentar função)
- Modify: `src/lib/env.ts` (acrescentar getters)
- Modify: `.env.example`
- Modify: `tests/helpers/fakes.ts:7` (literal da loja)

**Interfaces:**
- Consumes: nada novo.
- Produces:
  - Tipos em `@/lib/domain/types`: `Store` (+ `supportWhatsapp`, `loginImageUrl`), `StoreRef`, `ItemKind`, `Product`, `Module`, `Item`, `ModuleWithItems`, `ProductLink`, `EmailKind`, `AccessNotice`, `NoticeResult`.
  - `@/lib/access/access`: `grantedProductIds(orders: OrderRef[], links: ProductLink[], blocked: boolean): Set<string>`, `type ShelfProduct`, `type Shelf`, `buildShelf(products: Product[], granted: Set<string>): Shelf`.
  - `@/lib/data/products`: `PRODUCT_COLUMNS`, `MODULE_COLUMNS`, `ITEM_COLUMNS`, `toProduct`, `toModule`, `toItem`, `listProducts(storeId)`, `getProductById(id)`, `getProductBySlug(storeId, slug)`, `listModulesWithItems(productId, { publishedOnly })`, `getItemWithContext(itemId)`, `getProductLinks(storeId)`, `findStoreForProductCode(code): Promise<StoreRef | null>`, `getProductsForCode(code): Promise<{ id: string; title: string }[]>`.
  - `@/lib/data/stores`: `getStoreBySlug(slug)`, `getStoreById(id)`, `getDefaultStore()`, `toStore(row)`, `STORE_COLUMNS`.
  - `@/lib/data/orders`: `listAllOrderRefsByEmail(email): Promise<OrderRef[]>`.
  - `@/lib/data/access`: `loadStoreAccess(storeId, email): Promise<{ customer: CustomerRow | null; products: Product[]; granted: Set<string> }>`.
  - `env.emailDailyLimit: number`, `env.loginGuardSecret: string`, `env.turnstileSiteKey: string | null`, `env.turnstileSecretKey: string | null`.
  - Função SQL `public.store_customer_success(p_store_id uuid)` (usada na Task 4).

- [ ] **Step 1: Conferir o nome da restrição única atual de `offers`**

Rodar no MCP Supabase (`execute_sql`, projeto `tujtwlrxpetpiatlbrps`):

```sql
select conname from pg_constraint where conrelid = 'public.offers'::regclass and contype = 'u';
```

Expected: uma linha `offers_store_id_payt_product_code_key`. Se o nome for outro, usar o nome retornado no Step 2.

- [ ] **Step 2: Criar a migração aditiva**

Criar `supabase/migrations/20260917000001_cuspidora_base.sql`:

```sql
-- Lojas
alter table public.stores
  add column support_whatsapp text,
  add column login_image_url text;

alter table public.stores
  add constraint stores_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint stores_slug_reserved check (
    slug not in ('admin', 'api', 'entrar', 'sair', '_next', 'favicon.ico', 'manifest.webmanifest', 'sw.js', 'icons')
  );

-- Conteúdo
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  description text not null default '',
  cover_url text,
  banner_url text,
  checkout_url text,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);
create index products_store_idx on public.products(store_id, sort_order);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index modules_product_idx on public.modules(product_id, sort_order);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('arquivo', 'video', 'link')),
  url text not null,
  cover_url text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_module_idx on public.items(module_id, sort_order);

create table public.offer_products (
  offer_id uuid not null references public.offers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (offer_id, product_id)
);
create index offer_products_product_idx on public.offer_products(product_id);

-- Copia os materiais de exemplo: cada material vira produto (mesmo id) com um módulo e um item
insert into public.products (id, store_id, slug, title, description, cover_url, checkout_url, sort_order, is_published, created_at, updated_at)
select m.id, m.store_id, 'produto-' || left(replace(m.id::text, '-', ''), 8), m.title, m.description,
       m.cover_url, m.checkout_url, m.sort_order, m.is_published, m.created_at, m.updated_at
from public.materials m;

insert into public.modules (product_id, title)
select p.id, 'Conteúdo' from public.products p;

insert into public.items (module_id, title, kind, url)
select mo.id, m.title, 'arquivo', m.download_url
from public.materials m
join public.modules mo on mo.product_id = m.id;

insert into public.offer_products (offer_id, product_id)
select om.offer_id, om.material_id from public.offer_materials om;

-- Ofertas: código da Payt único no sistema inteiro (uma conta Payt para todas as lojas)
alter table public.offers drop constraint offers_store_id_payt_product_code_key;
alter table public.offers add constraint offers_payt_product_code_key unique (payt_product_code);

-- Pedidos: loja vem da oferta e pode ser desconhecida
alter table public.orders alter column store_id drop not null;
alter table public.orders
  add column source text not null default 'payt' check (source in ('payt', 'importado', 'manual'));

-- Avisos da Payt: campos para listar sem abrir o JSON
alter table public.payt_events
  add column customer_email text,
  add column product_codes text[] not null default '{}',
  add column payt_status text;
create index payt_events_outcome_idx on public.payt_events(outcome, received_at desc);

-- Registro de e-mails
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  customer_id uuid references public.customers(id) on delete cascade,
  to_email text not null,
  kind text not null check (kind in ('acesso_novo', 'produto_novo', 'reenvio')),
  product_ids uuid[] not null default '{}',
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'falhou')),
  error text,
  attempts integer not null default 1,
  provider_id text,
  resolved_by uuid references public.email_log(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_log_status_idx on public.email_log(status, created_at desc);
create index email_log_customer_idx on public.email_log(customer_id, created_at desc);

-- Abertura de itens (downloads, vídeos, links)
create table public.item_access (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  kind text not null check (kind in ('arquivo', 'video', 'link')),
  created_at timestamptz not null default now()
);
create index item_access_customer_store_idx on public.item_access(customer_id, store_id, created_at desc);

-- Tentativas de login por e-mail (hash) e loja
alter table public.login_attempts
  add column email_hash text,
  add column store_id uuid references public.stores(id) on delete set null;
create index login_attempts_email_created_idx on public.login_attempts(email_hash, created_at desc);

alter table public.products enable row level security;
alter table public.modules enable row level security;
alter table public.items enable row level security;
alter table public.offer_products enable row level security;
alter table public.email_log enable row level security;
alter table public.item_access enable row level security;

-- Loja do pedido pode ser nula; é preenchida quando passa a ser conhecida
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
         store_id = coalesce(o.store_id, p_store_id),
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

-- Sucesso do cliente: compradores da loja com último acesso e aberturas de itens
create or replace function public.store_customer_success(p_store_id uuid)
returns table (
  customer_id uuid,
  email text,
  first_paid_at timestamptz,
  paid_orders integer,
  last_seen_at timestamptz,
  item_opens integer,
  last_item_open_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with buyers as (
    select o.customer_email,
           min(coalesce(o.paid_at, o.created_at)) as first_paid_at,
           count(*)::integer as paid_orders
      from public.orders o
      join public.offers f on f.payt_product_code = o.payt_product_code
     where f.store_id = p_store_id
       and o.status = 'pago'
     group by o.customer_email
  )
  select c.id,
         c.email,
         b.first_paid_at,
         b.paid_orders,
         (select max(d.last_seen_at) from public.customer_devices d where d.customer_id = c.id),
         (select count(*)::integer from public.item_access a where a.customer_id = c.id and a.store_id = p_store_id),
         (select max(a.created_at) from public.item_access a where a.customer_id = c.id and a.store_id = p_store_id)
    from buyers b
    join public.customers c on c.email = b.customer_email
$$;

revoke execute on function public.store_customer_success(uuid) from public, anon, authenticated;
grant execute on function public.store_customer_success(uuid) to service_role;
```

- [ ] **Step 3: Aplicar a migração no Supabase**

Usar o MCP `apply_migration` com `name: "cuspidora_base"` e o conteúdo do Step 2. Depois conferir com `execute_sql`:

```sql
select
  (select count(*) from public.products) as produtos,
  (select count(*) from public.modules) as modulos,
  (select count(*) from public.items) as itens,
  (select count(*) from public.offer_products) as vinculos,
  (select count(*) from public.materials) as materiais_antigos,
  (select count(*) from public.offer_materials) as vinculos_antigos;
```

Expected: `produtos = materiais_antigos`, `modulos = produtos`, `itens = produtos`, `vinculos = vinculos_antigos`. Rodar também `get_advisors` (tipo `security`) e confirmar que não há alerta de RLS desligado nas tabelas novas.

- [ ] **Step 4: Substituir `src/lib/domain/types.ts`**

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
  supportWhatsapp: string | null
  loginImageUrl: string | null
}

export type StoreRef = Pick<Store, 'id' | 'slug' | 'name'>

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

export type ItemKind = 'arquivo' | 'video' | 'link'

export type Product = {
  id: string
  storeId: string
  slug: string
  title: string
  description: string
  coverUrl: string | null
  bannerUrl: string | null
  checkoutUrl: string | null
  isFeatured: boolean
  sortOrder: number
  isPublished: boolean
}

export type Module = {
  id: string
  productId: string
  title: string
  sortOrder: number
  isPublished: boolean
}

export type Item = {
  id: string
  moduleId: string
  title: string
  kind: ItemKind
  url: string
  coverUrl: string | null
  sortOrder: number
  isPublished: boolean
}

export type ModuleWithItems = Module & { items: Item[] }

export type ProductLink = { productCode: string; productId: string }

export type EmailKind = 'acesso_novo' | 'produto_novo' | 'reenvio'

export type AccessNotice = {
  customerId: string
  to: string
  customerName: string
  store: StoreRef
  products: { id: string; title: string }[]
  kind: EmailKind
}

export type NoticeResult = { ok: true } | { ok: false; error: string }
```

- [ ] **Step 5: Atualizar o literal da loja em `tests/helpers/fakes.ts:7`**

Trocar a linha 7 por:

```ts
  store: Store = { id: 'store-1', slug: 'arquitetura', name: 'Arquitetura', logoUrl: null, primaryColor: '#000', supportUrl: null, supportWhatsapp: null, loginImageUrl: null }
```

- [ ] **Step 6: Escrever o teste da regra de acesso por produto**

Criar `tests/access/shelf.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildShelf, grantedProductIds } from '@/lib/access/access'
import type { Product, ProductLink } from '@/lib/domain/types'

const links: ProductLink[] = [
  { productCode: 'BASICO', productId: 'atlas' },
  { productCode: 'COMPLETO', productId: 'atlas' },
  { productCode: 'COMPLETO', productId: 'bonus1' },
  { productCode: 'BUMP', productId: 'checklist' },
]

function product(id: string, sortOrder: number, extra: Partial<Product> = {}): Product {
  return {
    id, storeId: 's1', slug: id, title: id, description: `sobre ${id}`,
    coverUrl: null, bannerUrl: null, checkoutUrl: `https://payt/${id}`,
    isFeatured: false, sortOrder, isPublished: true, ...extra,
  }
}

describe('grantedProductIds', () => {
  it('libera os produtos das ofertas pagas', () => {
    const ids = grantedProductIds([{ productCode: 'COMPLETO', status: 'pago' }], links, false)
    expect([...ids].sort()).toEqual(['atlas', 'bonus1'])
  })

  it('reembolso de uma oferta mantém produto liberado por outra', () => {
    const ids = grantedProductIds(
      [{ productCode: 'BASICO', status: 'reembolsado' }, { productCode: 'COMPLETO', status: 'pago' }],
      links,
      false,
    )
    expect(ids.has('atlas')).toBe(true)
  })

  it('bump reembolsado com plano mantido remove só o bump', () => {
    const ids = grantedProductIds(
      [{ productCode: 'BASICO', status: 'pago' }, { productCode: 'BUMP', status: 'reembolsado' }],
      links,
      false,
    )
    expect([...ids]).toEqual(['atlas'])
  })

  it('código cadastrado depois passa a liberar', () => {
    const orders = [{ productCode: 'NOVO', status: 'pago' as const }]
    expect(grantedProductIds(orders, links, false).size).toBe(0)
    expect([...grantedProductIds(orders, [...links, { productCode: 'NOVO', productId: 'pack' }], false)]).toEqual(['pack'])
  })

  it('cliente bloqueado não tem acesso', () => {
    expect(grantedProductIds([{ productCode: 'COMPLETO', status: 'pago' }], links, true).size).toBe(0)
  })
})

describe('buildShelf', () => {
  const products = [
    product('bonus1', 2),
    product('atlas', 1),
    product('oculto', 0, { isPublished: false }),
    product('pack', 3, { isFeatured: true }),
  ]

  it('separa liberados e bloqueados em ordem e esconde não publicados', () => {
    const shelf = buildShelf(products, new Set(['atlas']))
    expect(shelf.unlocked.map((p) => p.id)).toEqual(['atlas'])
    expect(shelf.locked.map((p) => p.id)).toEqual(['bonus1', 'pack'])
  })

  it('usa o produto em destaque no topo', () => {
    expect(buildShelf(products, new Set(['atlas'])).featured?.id).toBe('pack')
  })

  it('sem destaque usa o primeiro liberado, depois o primeiro bloqueado', () => {
    const plain = products.map((p) => ({ ...p, isFeatured: false }))
    expect(buildShelf(plain, new Set(['bonus1'])).featured?.id).toBe('bonus1')
    expect(buildShelf(plain, new Set()).featured?.id).toBe('atlas')
    expect(buildShelf([], new Set()).featured).toBeNull()
  })

  it('só expõe checkout de produto bloqueado', () => {
    const shelf = buildShelf(products, new Set(['atlas']))
    expect(shelf.unlocked[0].checkoutUrl).toBeNull()
    expect(shelf.locked[0].checkoutUrl).toBe('https://payt/bonus1')
  })
})
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run tests/access/shelf.test.ts`
Expected: FAIL — `buildShelf` / `grantedProductIds` não exportados.

- [ ] **Step 8: Implementar no final de `src/lib/access/access.ts`**

Trocar a linha 1 por:

```ts
import type { Material, OfferLink, OrderRef, Product, ProductLink } from '@/lib/domain/types'
```

E acrescentar ao final do arquivo:

```ts
export function grantedProductIds(orders: OrderRef[], links: ProductLink[], blocked: boolean): Set<string> {
  const granted = new Set<string>()
  if (blocked) return granted

  const paidCodes = new Set(orders.filter((o) => o.status === 'pago').map((o) => o.productCode))
  for (const link of links) {
    if (paidCodes.has(link.productCode)) granted.add(link.productId)
  }
  return granted
}

export type ShelfProduct = {
  id: string
  slug: string
  title: string
  description: string
  coverUrl: string | null
  bannerUrl: string | null
  unlocked: boolean
  checkoutUrl: string | null
}

export type Shelf = { featured: ShelfProduct | null; unlocked: ShelfProduct[]; locked: ShelfProduct[] }

export function buildShelf(products: Product[], granted: Set<string>): Shelf {
  const visible = products.filter((p) => p.isPublished).sort((a, b) => a.sortOrder - b.sortOrder)
  const all: ShelfProduct[] = visible.map((p) => {
    const unlocked = granted.has(p.id)
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      coverUrl: p.coverUrl,
      bannerUrl: p.bannerUrl,
      unlocked,
      checkoutUrl: unlocked ? null : p.checkoutUrl,
    }
  })
  const unlocked = all.filter((p) => p.unlocked)
  const locked = all.filter((p) => !p.unlocked)
  const featuredId = visible.find((p) => p.isFeatured)?.id
  const featured = all.find((p) => p.id === featuredId) ?? unlocked[0] ?? locked[0] ?? null
  return { featured, unlocked, locked }
}
```

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run tests/access/shelf.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 10: Substituir `src/lib/data/stores.ts`**

```ts
import type { Store } from '@/lib/domain/types'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

export const STORE_COLUMNS = 'id, slug, name, logo_url, primary_color, support_url, support_whatsapp, login_image_url'

type DbStore = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  primary_color: string
  support_url: string | null
  support_whatsapp: string | null
  login_image_url: string | null
}

export function toStore(row: DbStore): Store {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    supportUrl: row.support_url,
    supportWhatsapp: row.support_whatsapp,
    loginImageUrl: row.login_image_url,
  }
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const { data, error } = await createAdminClient().from('stores').select(STORE_COLUMNS).eq('slug', slug).maybeSingle()
  if (error) throw error
  return data ? toStore(data as DbStore) : null
}

export async function getStoreById(id: string): Promise<Store | null> {
  const { data, error } = await createAdminClient().from('stores').select(STORE_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toStore(data as DbStore) : null
}

export async function getDefaultStore(): Promise<Store> {
  const store = await getStoreBySlug(env.defaultStoreSlug)
  if (!store) throw new Error(`Loja não encontrada: ${env.defaultStoreSlug}`)
  return store
}
```

- [ ] **Step 11: Criar `src/lib/data/products.ts`**

```ts
import type { Item, ItemKind, Module, ModuleWithItems, Product, ProductLink, StoreRef } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

export const PRODUCT_COLUMNS =
  'id, store_id, slug, title, description, cover_url, banner_url, checkout_url, is_featured, sort_order, is_published'
export const MODULE_COLUMNS = 'id, product_id, title, sort_order, is_published'
export const ITEM_COLUMNS = 'id, module_id, title, kind, url, cover_url, sort_order, is_published'

export type DbProduct = {
  id: string
  store_id: string
  slug: string
  title: string
  description: string
  cover_url: string | null
  banner_url: string | null
  checkout_url: string | null
  is_featured: boolean
  sort_order: number
  is_published: boolean
}

export type DbModule = { id: string; product_id: string; title: string; sort_order: number; is_published: boolean }

export type DbItem = {
  id: string
  module_id: string
  title: string
  kind: ItemKind
  url: string
  cover_url: string | null
  sort_order: number
  is_published: boolean
}

export function toProduct(row: DbProduct): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    bannerUrl: row.banner_url,
    checkoutUrl: row.checkout_url,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  }
}

export function toModule(row: DbModule): Module {
  return { id: row.id, productId: row.product_id, title: row.title, sortOrder: row.sort_order, isPublished: row.is_published }
}

export function toItem(row: DbItem): Item {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    kind: row.kind,
    url: row.url,
    coverUrl: row.cover_url,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  }
}

export async function listProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await createAdminClient()
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('store_id', storeId)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return (data as DbProduct[]).map(toProduct)
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await createAdminClient().from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toProduct(data as DbProduct) : null
}

export async function getProductBySlug(storeId: string, slug: string): Promise<Product | null> {
  const { data, error } = await createAdminClient()
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('store_id', storeId)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data ? toProduct(data as DbProduct) : null
}

export async function listModulesWithItems(productId: string, opts: { publishedOnly: boolean }): Promise<ModuleWithItems[]> {
  const db = createAdminClient()
  const { data: moduleRows, error } = await db
    .from('modules')
    .select(MODULE_COLUMNS)
    .eq('product_id', productId)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  const modules = (moduleRows as DbModule[]).map(toModule).filter((m) => !opts.publishedOnly || m.isPublished)
  if (modules.length === 0) return []

  const { data: itemRows, error: itemsError } = await db
    .from('items')
    .select(ITEM_COLUMNS)
    .in('module_id', modules.map((m) => m.id))
    .order('sort_order')
    .order('created_at')
  if (itemsError) throw itemsError
  const items = (itemRows as DbItem[]).map(toItem).filter((i) => !opts.publishedOnly || i.isPublished)
  return modules.map((m) => ({ ...m, items: items.filter((i) => i.moduleId === m.id) }))
}

export async function getItemWithContext(itemId: string): Promise<{ item: Item; module: Module; product: Product } | null> {
  const db = createAdminClient()
  const { data: itemRow, error } = await db.from('items').select(ITEM_COLUMNS).eq('id', itemId).maybeSingle()
  if (error) throw error
  if (!itemRow) return null
  const item = toItem(itemRow as DbItem)

  const { data: moduleRow, error: moduleError } = await db.from('modules').select(MODULE_COLUMNS).eq('id', item.moduleId).single()
  if (moduleError) throw moduleError
  const parent = toModule(moduleRow as DbModule)

  const product = await getProductById(parent.productId)
  return product ? { item, module: parent, product } : null
}

export async function getProductLinks(storeId: string): Promise<ProductLink[]> {
  const { data, error } = await createAdminClient()
    .from('offers')
    .select('payt_product_code, offer_products(product_id)')
    .eq('store_id', storeId)
  if (error) throw error
  return data.flatMap((offer) =>
    (offer.offer_products as { product_id: string }[]).map((link) => ({
      productCode: offer.payt_product_code as string,
      productId: link.product_id,
    })),
  )
}

export async function findStoreForProductCode(code: string): Promise<StoreRef | null> {
  const { data, error } = await createAdminClient()
    .from('offers')
    .select('stores(id, slug, name)')
    .eq('payt_product_code', code)
    .maybeSingle()
  if (error) throw error
  return (data?.stores as unknown as StoreRef | null) ?? null
}

export async function getProductsForCode(code: string): Promise<{ id: string; title: string }[]> {
  const { data, error } = await createAdminClient()
    .from('offers')
    .select('offer_products(products(id, title, sort_order, is_published))')
    .eq('payt_product_code', code)
    .maybeSingle()
  if (error) throw error
  if (!data) return []

  type Linked = { id: string; title: string; sort_order: number; is_published: boolean }
  return (data.offer_products as unknown as { products: Linked | null }[])
    .map((row) => row.products)
    .filter((p): p is Linked => p !== null && p.is_published)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({ id: p.id, title: p.title }))
}
```

- [ ] **Step 12: Acrescentar `listAllOrderRefsByEmail` em `src/lib/data/orders.ts`** (logo após `listOrderRefsByEmail`)

```ts
export async function listAllOrderRefsByEmail(email: string): Promise<OrderRef[]> {
  const { data, error } = await createAdminClient()
    .from('orders')
    .select('payt_product_code, status')
    .eq('customer_email', email)
  if (error) throw error
  return data.map((o) => ({ productCode: o.payt_product_code, status: o.status as OrderStatus }))
}
```

- [ ] **Step 13: Acrescentar `loadStoreAccess` em `src/lib/data/access.ts`**

Substituir o arquivo por:

```ts
import { grantedMaterialIds, grantedProductIds } from '@/lib/access/access'
import type { CustomerRow, Material, Product } from '@/lib/domain/types'
import { getOfferLinks, listMaterials } from './catalog'
import { findCustomerByEmail } from './customers'
import { listAllOrderRefsByEmail, listOrderRefsByEmail } from './orders'
import { getProductLinks, listProducts } from './products'

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

export async function loadStoreAccess(
  storeId: string,
  email: string,
): Promise<{ customer: CustomerRow | null; products: Product[]; granted: Set<string> }> {
  const [customer, products, links, orders] = await Promise.all([
    findCustomerByEmail(email),
    listProducts(storeId),
    getProductLinks(storeId),
    listAllOrderRefsByEmail(email),
  ])
  const granted = grantedProductIds(orders, links, !customer || customer.blockedAt !== null)
  return { customer, products, granted }
}
```

- [ ] **Step 14: Variáveis de ambiente**

Em `src/lib/env.ts`, acrescentar dentro do objeto `env`, depois de `defaultStoreSlug`:

```ts
  get emailDailyLimit() {
    const value = Number(process.env.EMAIL_DAILY_LIMIT)
    return Number.isFinite(value) && value > 0 ? value : 100
  },
  get loginGuardSecret() { return required('LOGIN_GUARD_SECRET') },
  get turnstileSiteKey() { return process.env.TURNSTILE_SITE_KEY || null },
  get turnstileSecretKey() { return process.env.TURNSTILE_SECRET_KEY || null },
```

Acrescentar ao final de `.env.example`:

```
EMAIL_DAILY_LIMIT=100
LOGIN_GUARD_SECRET=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Gerar o segredo local sem exibir o valor (PowerShell):

```powershell
$bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
Add-Content -Path .env.local -Value ("LOGIN_GUARD_SECRET=" + [Convert]::ToBase64String($bytes)) -Encoding utf8
```

- [ ] **Step 15: Verificar tudo**

Run: `npm test` → Expected: todos passam (47 antigos + 9 novos).
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: build concluído.

- [ ] **Step 16: Commit**

```bash
git add supabase/migrations/20260917000001_cuspidora_base.sql src/lib/domain/types.ts src/lib/access/access.ts src/lib/data/stores.ts src/lib/data/products.ts src/lib/data/orders.ts src/lib/data/access.ts src/lib/env.ts .env.example tests/access/shelf.test.ts tests/helpers/fakes.ts
git commit -m "feat: base multi-loja (produtos, módulos, itens, registros) e acesso por produto"
```

---

### Task 2: Registro de e-mails, notificador e reenvio em lote

**Executor:** Codex (frente A).

**Files:**
- Create: `src/lib/email/html.ts`, `src/lib/email/access-template.ts`, `src/lib/email/notifier.ts`, `src/lib/email/batch.ts`, `src/lib/email/resend-transport.ts`, `src/lib/email/server.ts`, `src/lib/data/email-log.ts`
- Create: `tests/email/html.test.ts`, `tests/email/access-template.test.ts`, `tests/email/notifier.test.ts`, `tests/email/batch.test.ts`
- Modify: `src/lib/email/templates.ts:3-10` (usar `escapeHtml` de `html.ts`)
- Modify: `src/app/admin/(painel)/clientes/actions.ts` (função `reenviarAcesso` e imports)

**Interfaces:**
- Consumes (Task 1): `AccessNotice`, `NoticeResult`, `EmailKind` de `@/lib/domain/types`; `loadStoreAccess`; `getStoreById`, `getDefaultStore`; `getCustomer` (já existe em `@/lib/data/customers`); `env.emailDailyLimit`.
- Produces:
  - `@/lib/email/notifier`: `type OutgoingEmail`, `interface EmailTransport`, `type EmailLogStart`, `type EmailLogFinish`, `interface EmailLogRepo`, `type NoticeOutcome = NoticeResult & { logId: string }`, `formatFrom(storeName, emailFrom)`, `loginUrlFor(appUrl, storeSlug, email)`, `sendAccessNotice(notice, deps)`.
  - `@/lib/email/batch`: `type FailedEmail`, `type BatchGroup`, `type BatchSummary = { sent; failed; skipped; remaining }`, `groupFailedEmails(failed)`, `runResendBatch(deps)`.
  - `@/lib/email/server`: `notifyAccess(notice): Promise<NoticeOutcome>`, `buildResendNotice(group)`, `resendFailedEmails(): Promise<BatchSummary>`, `resendEmailLogEntry(logId): Promise<NoticeResult>`, `resendAccessForCustomer(customerId, storeId): Promise<NoticeResult>`.
  - `@/lib/data/email-log`: `type EmailLogStatus`, `type EmailLogFilter = 'todos' | EmailLogStatus`, `EMAIL_LOG_PAGE_SIZE = 50`, `type EmailLogEntry`, `createEmailLogRepo()`, `listEmailLog(filter, page)`, `getEmailLogEntry(id)`, `listUnresolvedFailed()`, `countUnresolvedFailed()`, `countEmailsUsedToday()`, `markEmailsResolved(ids, resolvedBy)`.

- [ ] **Step 1: Escrever os testes**

Criar `tests/email/html.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { escapeHtml } from '@/lib/email/html'

describe('escapeHtml', () => {
  it('escapa caracteres especiais', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;')
  })
})
```

Criar `tests/email/access-template.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { AccessNotice } from '@/lib/domain/types'
import { accessNoticeEmail } from '@/lib/email/access-template'

const notice: AccessNotice = {
  customerId: 'c1',
  to: 'joao@gmail.com',
  customerName: 'João Silva',
  store: { id: 's1', slug: 'arquitetura', name: 'Arquitetura' },
  products: [{ id: 'p1', title: 'Atlas Visual' }, { id: 'p2', title: 'Bônus <1>' }],
  kind: 'acesso_novo',
}
const url = 'https://app.test/arquitetura/entrar?email=joao%40gmail.com'

describe('accessNoticeEmail', () => {
  it('primeiro acesso lista produtos, escapa títulos e aponta para o login da loja', () => {
    const email = accessNoticeEmail(notice, url)
    expect(email.subject).toBe('Seu acesso chegou — Arquitetura')
    expect(email.html).toContain('Olá, João!')
    expect(email.html).toContain('Atlas Visual')
    expect(email.html).toContain('Bônus &lt;1&gt;')
    expect(email.html).toContain(`href="${url}"`)
    expect(email.html).toContain('Acessar meus produtos')
  })

  it('assunto muda para produto novo e reenvio', () => {
    expect(accessNoticeEmail({ ...notice, kind: 'produto_novo' }, url).subject).toBe('Novo produto liberado — Arquitetura')
    expect(accessNoticeEmail({ ...notice, kind: 'reenvio' }, url).subject).toBe('Seu acesso — Arquitetura')
  })

  it('funciona sem nome e sem produtos', () => {
    const email = accessNoticeEmail({ ...notice, customerName: '', products: [] }, url)
    expect(email.html).toContain('Olá!')
    expect(email.html).not.toContain('<ul')
  })
})
```

Criar `tests/email/notifier.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import type { AccessNotice } from '@/lib/domain/types'
import {
  formatFrom,
  loginUrlFor,
  sendAccessNotice,
  type EmailLogFinish,
  type EmailLogRepo,
  type EmailLogStart,
  type EmailTransport,
  type OutgoingEmail,
} from '@/lib/email/notifier'

class FakeLog implements EmailLogRepo {
  rows: ({ id: string } & EmailLogStart & Partial<EmailLogFinish>)[] = []
  async start(entry: EmailLogStart) {
    const id = `log-${this.rows.length + 1}`
    this.rows.push({ id, ...entry })
    return id
  }
  async finish(id: string, result: EmailLogFinish) {
    Object.assign(this.rows.find((r) => r.id === id)!, result)
  }
}

class FakeTransport implements EmailTransport {
  sent: OutgoingEmail[] = []
  fail: string | null = null
  async send(email: OutgoingEmail) {
    if (this.fail) throw new Error(this.fail)
    this.sent.push(email)
    return { providerId: `re_${this.sent.length}` }
  }
}

const notice: AccessNotice = {
  customerId: 'c1',
  to: 'joao@gmail.com',
  customerName: 'João',
  store: { id: 's1', slug: 'arquitetura', name: 'Arquitetura' },
  products: [{ id: 'p1', title: 'Atlas Visual' }],
  kind: 'acesso_novo',
}

let log: FakeLog
let transport: FakeTransport
const deps = () => ({ log, transport, appUrl: 'https://app.test/', emailFrom: 'Área de Membros <acesso@grupoelevamax.com>' })

beforeEach(() => {
  log = new FakeLog()
  transport = new FakeTransport()
})

describe('formatFrom', () => {
  it('usa o nome da loja com o endereço configurado', () => {
    expect(formatFrom('Arquitetura', 'acesso@grupoelevamax.com')).toBe('"Arquitetura" <acesso@grupoelevamax.com>')
    expect(formatFrom('Arquitetura', 'Área de Membros <acesso@grupoelevamax.com>')).toBe('"Arquitetura" <acesso@grupoelevamax.com>')
  })

  it('remove caracteres que quebram o cabeçalho', () => {
    expect(formatFrom('Loja "X" <y>', 'a@b.com')).toBe('"Loja X y" <a@b.com>')
  })
})

describe('loginUrlFor', () => {
  it('monta o login da loja com o e-mail preenchido', () => {
    expect(loginUrlFor('https://app.test/', 'arquitetura', 'joao@gmail.com')).toBe(
      'https://app.test/arquitetura/entrar?email=joao%40gmail.com',
    )
  })
})

describe('sendAccessNotice', () => {
  it('registra o envio e marca como enviado', async () => {
    const result = await sendAccessNotice(notice, deps())
    expect(result).toEqual({ ok: true, logId: 'log-1' })
    expect(log.rows[0]).toMatchObject({
      storeId: 's1', customerId: 'c1', toEmail: 'joao@gmail.com', kind: 'acesso_novo',
      productIds: ['p1'], status: 'enviado', providerId: 're_1',
    })
    expect(transport.sent[0]).toMatchObject({
      from: '"Arquitetura" <acesso@grupoelevamax.com>',
      to: 'joao@gmail.com',
      subject: 'Seu acesso chegou — Arquitetura',
    })
    expect(transport.sent[0].html).toContain('https://app.test/arquitetura/entrar?email=joao%40gmail.com')
  })

  it('falha no envio vira falhou com o erro', async () => {
    transport.fail = 'domínio não verificado'
    const result = await sendAccessNotice(notice, deps())
    expect(result).toEqual({ ok: false, error: 'domínio não verificado', logId: 'log-1' })
    expect(log.rows[0]).toMatchObject({ status: 'falhou', error: 'domínio não verificado' })
  })
})
```

Criar `tests/email/batch.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { AccessNotice } from '@/lib/domain/types'
import { groupFailedEmails, runResendBatch, type BatchGroup, type FailedEmail } from '@/lib/email/batch'

const failed = (id: string, customerId: string | null, storeId: string | null, createdAt: string): FailedEmail => ({
  id, customerId, storeId, toEmail: `${customerId}@x.com`, createdAt,
})

function setup(opts: { failed: FailedEmail[]; usedToday?: number; dailyLimit?: number; failFor?: string[]; noProductsFor?: string[] }) {
  const resolved: { logIds: string[]; by: string }[] = []
  const sentTo: string[] = []
  let count = 0
  const deps = {
    listUnresolvedFailed: async () => opts.failed,
    countUsedToday: async () => opts.usedToday ?? 0,
    dailyLimit: opts.dailyLimit ?? 100,
    buildNotice: async (group: BatchGroup): Promise<AccessNotice | null> =>
      opts.noProductsFor?.includes(group.customerId)
        ? null
        : {
            customerId: group.customerId,
            to: group.toEmail,
            customerName: '',
            store: { id: group.storeId, slug: 'loja', name: 'Loja' },
            products: [{ id: 'p1', title: 'Produto' }],
            kind: 'reenvio',
          },
    send: async (notice: AccessNotice) => {
      count++
      if (opts.failFor?.includes(notice.customerId)) return { ok: false as const, error: 'falhou', logId: `novo-${count}` }
      sentTo.push(notice.customerId)
      return { ok: true as const, logId: `novo-${count}` }
    },
    markResolved: async (logIds: string[], by: string) => {
      resolved.push({ logIds, by })
    },
  }
  return { deps, resolved, sentTo }
}

const list = [
  failed('l1', 'c1', 's1', '2026-09-16T10:00:00Z'),
  failed('l2', 'c1', 's1', '2026-09-16T11:00:00Z'),
  failed('l3', 'c2', 's1', '2026-09-16T12:00:00Z'),
  failed('l4', 'c3', 's1', '2026-09-16T13:00:00Z'),
]

describe('groupFailedEmails', () => {
  it('agrupa por cliente e loja, do mais antigo para o mais novo, e ignora registros incompletos', () => {
    const groups = groupFailedEmails([
      failed('l3', 'c2', 's1', '2026-09-16T12:00:00Z'),
      failed('l1', 'c1', 's1', '2026-09-16T10:00:00Z'),
      failed('l2', 'c1', 's1', '2026-09-16T11:00:00Z'),
      failed('l4', 'c1', 's2', '2026-09-16T13:00:00Z'),
      failed('l5', null, 's1', '2026-09-16T09:00:00Z'),
    ])
    expect(groups).toEqual([
      { customerId: 'c1', storeId: 's1', toEmail: 'c1@x.com', logIds: ['l1', 'l2'] },
      { customerId: 'c2', storeId: 's1', toEmail: 'c2@x.com', logIds: ['l3'] },
      { customerId: 'c1', storeId: 's2', toEmail: 'c1@x.com', logIds: ['l4'] },
    ])
  })
})

describe('runResendBatch', () => {
  it('envia um e-mail por cliente e marca os registros antigos como resolvidos', async () => {
    const { deps, resolved, sentTo } = setup({ failed: list })
    expect(await runResendBatch(deps)).toEqual({ sent: 3, failed: 0, skipped: 0, remaining: 0 })
    expect(sentTo).toEqual(['c1', 'c2', 'c3'])
    expect(resolved[0]).toEqual({ logIds: ['l1', 'l2'], by: 'novo-1' })
  })

  it('respeita o limite diário e informa o que ficou para depois', async () => {
    const { deps, sentTo } = setup({ failed: list, usedToday: 99, dailyLimit: 100 })
    expect(await runResendBatch(deps)).toEqual({ sent: 1, failed: 0, skipped: 0, remaining: 2 })
    expect(sentTo).toEqual(['c1'])
  })

  it('não envia nada quando o limite já foi atingido', async () => {
    const { deps } = setup({ failed: list, usedToday: 120, dailyLimit: 100 })
    expect(await runResendBatch(deps)).toEqual({ sent: 0, failed: 0, skipped: 0, remaining: 3 })
  })

  it('conta falhas e clientes sem produtos sem marcar como resolvidos', async () => {
    const { deps, resolved } = setup({ failed: list, failFor: ['c2'], noProductsFor: ['c3'] })
    expect(await runResendBatch(deps)).toEqual({ sent: 1, failed: 1, skipped: 1, remaining: 0 })
    expect(resolved).toHaveLength(1)
  })

  it('limita a 100 por execução', async () => {
    const many = Array.from({ length: 120 }, (_, i) => failed(`l${i}`, `c${i}`, 's1', new Date(Date.UTC(2026, 8, 16, 0, i)).toISOString()))
    const { deps } = setup({ failed: many, dailyLimit: 1000 })
    expect(await runResendBatch(deps)).toEqual({ sent: 100, failed: 0, skipped: 0, remaining: 20 })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/email`
Expected: FAIL — módulos `@/lib/email/html`, `access-template`, `notifier`, `batch` não existem (o teste antigo `templates.test.ts` continua passando).

- [ ] **Step 3: Implementar `src/lib/email/html.ts`**

```ts
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```

Em `src/lib/email/templates.ts`, substituir as linhas 1–10 (import + função `escapeHtml`) por:

```ts
import type { AccessEmail } from '@/lib/orders/process-postback'
import { escapeHtml } from './html'

export { escapeHtml }
```

- [ ] **Step 4: Implementar `src/lib/email/access-template.ts`**

```ts
import type { AccessNotice, EmailKind } from '@/lib/domain/types'
import { escapeHtml } from './html'

const SUBJECTS: Record<EmailKind, string> = {
  acesso_novo: 'Seu acesso chegou',
  produto_novo: 'Novo produto liberado',
  reenvio: 'Seu acesso',
}

const INTROS: Record<EmailKind, string> = {
  acesso_novo: 'Sua compra foi confirmada e sua área de membros já está liberada.',
  produto_novo: 'Um novo produto foi liberado na sua área de membros.',
  reenvio: 'Aqui está o seu acesso à área de membros.',
}

export function accessNoticeEmail(notice: AccessNotice, loginUrl: string): { subject: string; html: string } {
  const store = escapeHtml(notice.store.name)
  const subject = `${SUBJECTS[notice.kind]} — ${notice.store.name}`
  const firstName = notice.customerName.trim().split(/\s+/)[0]
  const greeting = firstName ? `Olá, ${escapeHtml(firstName)}!` : 'Olá!'
  const list = notice.products.length
    ? `<ul style="padding-left:20px;margin:16px 0">${notice.products
        .map((p) => `<li style="margin:4px 0">${escapeHtml(p.title)}</li>`)
        .join('')}</ul>`
    : ''

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
<p style="margin:0 0 8px;font-size:13px;color:#71717a">${store}</p>
<h1 style="margin:0 0 16px;font-size:22px">${greeting}</h1>
<p style="margin:0;font-size:16px;line-height:1.5">${INTROS[notice.kind]}</p>
${list}
<p style="margin:24px 0"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#e11d2e;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold">Acessar meus produtos</a></p>
<p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">Para entrar, use este mesmo e-mail: ${escapeHtml(notice.to)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`

  return { subject, html }
}
```

- [ ] **Step 5: Implementar `src/lib/email/notifier.ts`**

```ts
import type { AccessNotice, EmailKind, NoticeResult } from '@/lib/domain/types'
import { accessNoticeEmail } from './access-template'

export type OutgoingEmail = { from: string; to: string; subject: string; html: string }

export interface EmailTransport {
  send(email: OutgoingEmail): Promise<{ providerId: string | null }>
}

export type EmailLogStart = { storeId: string; customerId: string; toEmail: string; kind: EmailKind; productIds: string[] }

export type EmailLogFinish = { status: 'enviado'; providerId: string | null } | { status: 'falhou'; error: string }

export interface EmailLogRepo {
  start(entry: EmailLogStart): Promise<string>
  finish(id: string, result: EmailLogFinish): Promise<void>
}

export type NoticeOutcome = NoticeResult & { logId: string }

export function formatFrom(storeName: string, emailFrom: string): string {
  const address = emailFrom.match(/<([^>]+)>/)?.[1]?.trim() ?? emailFrom.trim()
  const name = storeName.replace(/["<>\r\n]/g, '').replace(/\s+/g, ' ').trim()
  return name ? `"${name}" <${address}>` : address
}

export function loginUrlFor(appUrl: string, storeSlug: string, email: string): string {
  return `${appUrl.replace(/\/$/, '')}/${storeSlug}/entrar?email=${encodeURIComponent(email)}`
}

export async function sendAccessNotice(
  notice: AccessNotice,
  deps: { log: EmailLogRepo; transport: EmailTransport; appUrl: string; emailFrom: string },
): Promise<NoticeOutcome> {
  const logId = await deps.log.start({
    storeId: notice.store.id,
    customerId: notice.customerId,
    toEmail: notice.to,
    kind: notice.kind,
    productIds: notice.products.map((p) => p.id),
  })

  try {
    const { subject, html } = accessNoticeEmail(notice, loginUrlFor(deps.appUrl, notice.store.slug, notice.to))
    const { providerId } = await deps.transport.send({
      from: formatFrom(notice.store.name, deps.emailFrom),
      to: notice.to,
      subject,
      html,
    })
    await deps.log.finish(logId, { status: 'enviado', providerId })
    return { ok: true, logId }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await deps.log.finish(logId, { status: 'falhou', error })
    return { ok: false, error, logId }
  }
}
```

- [ ] **Step 6: Implementar `src/lib/email/batch.ts`**

```ts
import type { AccessNotice } from '@/lib/domain/types'
import type { NoticeOutcome } from './notifier'

export type FailedEmail = { id: string; storeId: string | null; customerId: string | null; toEmail: string; createdAt: string }

export type BatchGroup = { storeId: string; customerId: string; toEmail: string; logIds: string[] }

export type BatchSummary = { sent: number; failed: number; skipped: number; remaining: number }

export const MAX_RESEND_PER_RUN = 100

export function groupFailedEmails(failed: FailedEmail[]): BatchGroup[] {
  const groups = new Map<string, BatchGroup>()
  const sorted = [...failed].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  for (const entry of sorted) {
    if (!entry.storeId || !entry.customerId) continue
    const key = `${entry.customerId}|${entry.storeId}`
    const group = groups.get(key)
    if (group) group.logIds.push(entry.id)
    else groups.set(key, { storeId: entry.storeId, customerId: entry.customerId, toEmail: entry.toEmail, logIds: [entry.id] })
  }
  return [...groups.values()]
}

export async function runResendBatch(deps: {
  listUnresolvedFailed(): Promise<FailedEmail[]>
  countUsedToday(): Promise<number>
  dailyLimit: number
  buildNotice(group: BatchGroup): Promise<AccessNotice | null>
  send(notice: AccessNotice): Promise<NoticeOutcome>
  markResolved(logIds: string[], resolvedBy: string): Promise<void>
}): Promise<BatchSummary> {
  const groups = groupFailedEmails(await deps.listUnresolvedFailed())
  const slots = Math.max(0, Math.min(deps.dailyLimit - (await deps.countUsedToday()), MAX_RESEND_PER_RUN))
  const batch = groups.slice(0, slots)
  const summary: BatchSummary = { sent: 0, failed: 0, skipped: 0, remaining: groups.length - batch.length }

  for (const group of batch) {
    const notice = await deps.buildNotice(group)
    if (!notice) {
      summary.skipped++
      continue
    }
    const result = await deps.send(notice)
    if (result.ok) {
      summary.sent++
      await deps.markResolved(group.logIds, result.logId)
    } else {
      summary.failed++
    }
  }
  return summary
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run tests/email`
Expected: PASS (todos os arquivos de `tests/email`).

- [ ] **Step 8: Implementar `src/lib/email/resend-transport.ts`**

```ts
import { Resend } from 'resend'
import { env } from '@/lib/env'
import type { EmailTransport } from './notifier'

export function createResendTransport(): EmailTransport {
  const resend = new Resend(env.resendApiKey)
  return {
    async send(email) {
      const { data, error } = await resend.emails.send(email)
      if (error) throw new Error(error.message)
      return { providerId: data?.id ?? null }
    },
  }
}
```

- [ ] **Step 9: Implementar `src/lib/data/email-log.ts`**

```ts
import type { EmailKind } from '@/lib/domain/types'
import type { FailedEmail } from '@/lib/email/batch'
import type { EmailLogRepo } from '@/lib/email/notifier'
import { createAdminClient } from '@/lib/supabase/admin'

export type EmailLogStatus = 'pendente' | 'enviado' | 'falhou'
export type EmailLogFilter = 'todos' | EmailLogStatus
export const EMAIL_LOG_PAGE_SIZE = 50

export type EmailLogEntry = {
  id: string
  createdAt: string
  sentAt: string | null
  storeId: string | null
  storeName: string | null
  customerId: string | null
  toEmail: string
  kind: EmailKind
  status: EmailLogStatus
  error: string | null
  resolved: boolean
}

type DbEntry = {
  id: string
  created_at: string
  sent_at: string | null
  store_id: string | null
  customer_id: string | null
  to_email: string
  kind: EmailKind
  status: EmailLogStatus
  error: string | null
  resolved_by: string | null
  stores: { name: string } | null
}

const ENTRY_COLUMNS = 'id, created_at, sent_at, store_id, customer_id, to_email, kind, status, error, resolved_by, stores(name)'

function toEntry(row: DbEntry): EmailLogEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    storeId: row.store_id,
    storeName: row.stores?.name ?? null,
    customerId: row.customer_id,
    toEmail: row.to_email,
    kind: row.kind,
    status: row.status,
    error: row.error,
    resolved: row.resolved_by !== null,
  }
}

export function createEmailLogRepo(): EmailLogRepo {
  const db = createAdminClient()
  return {
    async start(entry) {
      const { data, error } = await db
        .from('email_log')
        .insert({
          store_id: entry.storeId,
          customer_id: entry.customerId,
          to_email: entry.toEmail,
          kind: entry.kind,
          product_ids: entry.productIds,
          status: 'pendente',
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    async finish(id, result) {
      const row =
        result.status === 'enviado'
          ? { status: 'enviado', provider_id: result.providerId, sent_at: new Date().toISOString(), error: null }
          : { status: 'falhou', error: result.error }
      const { error } = await db.from('email_log').update(row).eq('id', id)
      if (error) throw error
    },
  }
}

export async function listEmailLog(filter: EmailLogFilter, page: number): Promise<{ entries: EmailLogEntry[]; hasMore: boolean }> {
  const from = Math.max(0, page) * EMAIL_LOG_PAGE_SIZE
  let query = createAdminClient()
    .from('email_log')
    .select(ENTRY_COLUMNS)
    .order('created_at', { ascending: false })
    .range(from, from + EMAIL_LOG_PAGE_SIZE)
  if (filter !== 'todos') query = query.eq('status', filter)
  const { data, error } = await query
  if (error) throw error
  const rows = (data as unknown as DbEntry[]).map(toEntry)
  return { entries: rows.slice(0, EMAIL_LOG_PAGE_SIZE), hasMore: rows.length > EMAIL_LOG_PAGE_SIZE }
}

export async function getEmailLogEntry(id: string): Promise<EmailLogEntry | null> {
  const { data, error } = await createAdminClient().from('email_log').select(ENTRY_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toEntry(data as unknown as DbEntry) : null
}

export async function listUnresolvedFailed(): Promise<FailedEmail[]> {
  const { data, error } = await createAdminClient()
    .from('email_log')
    .select('id, store_id, customer_id, to_email, created_at')
    .eq('status', 'falhou')
    .is('resolved_by', null)
    .order('created_at')
    .limit(1000)
  if (error) throw error
  return data.map((row) => ({
    id: row.id as string,
    storeId: row.store_id as string | null,
    customerId: row.customer_id as string | null,
    toEmail: row.to_email as string,
    createdAt: row.created_at as string,
  }))
}

export async function countUnresolvedFailed(): Promise<number> {
  const { count, error } = await createAdminClient()
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'falhou')
    .is('resolved_by', null)
  if (error) throw error
  return count ?? 0
}

export async function countEmailsUsedToday(): Promise<number> {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const { count, error } = await createAdminClient()
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .in('status', ['enviado', 'pendente'])
    .gte('created_at', start.toISOString())
  if (error) throw error
  return count ?? 0
}

export async function markEmailsResolved(ids: string[], resolvedBy: string): Promise<void> {
  if (ids.length === 0) return
  const { error } = await createAdminClient().from('email_log').update({ resolved_by: resolvedBy }).in('id', ids)
  if (error) throw error
}
```

- [ ] **Step 10: Implementar `src/lib/email/server.ts`**

```ts
import { loadStoreAccess } from '@/lib/data/access'
import { getCustomer } from '@/lib/data/customers'
import {
  countEmailsUsedToday,
  createEmailLogRepo,
  getEmailLogEntry,
  listUnresolvedFailed,
  markEmailsResolved,
} from '@/lib/data/email-log'
import { getStoreById } from '@/lib/data/stores'
import type { AccessNotice, NoticeResult } from '@/lib/domain/types'
import { env } from '@/lib/env'
import { runResendBatch, type BatchSummary } from './batch'
import { sendAccessNotice, type NoticeOutcome } from './notifier'
import { createResendTransport } from './resend-transport'

export function notifyAccess(notice: AccessNotice): Promise<NoticeOutcome> {
  return sendAccessNotice(notice, {
    log: createEmailLogRepo(),
    transport: createResendTransport(),
    appUrl: env.appUrl,
    emailFrom: env.emailFrom,
  })
}

export async function buildResendNotice(group: { storeId: string; customerId: string }): Promise<AccessNotice | null> {
  const [store, customer] = await Promise.all([getStoreById(group.storeId), getCustomer(group.customerId)])
  if (!store || !customer || customer.blockedAt) return null
  const { products, granted } = await loadStoreAccess(store.id, customer.email)
  const unlocked = products.filter((p) => p.isPublished && granted.has(p.id)).sort((a, b) => a.sortOrder - b.sortOrder)
  if (unlocked.length === 0) return null
  return {
    customerId: customer.id,
    to: customer.email,
    customerName: customer.name,
    store: { id: store.id, slug: store.slug, name: store.name },
    products: unlocked.map((p) => ({ id: p.id, title: p.title })),
    kind: 'reenvio',
  }
}

export function resendFailedEmails(): Promise<BatchSummary> {
  return runResendBatch({
    listUnresolvedFailed,
    countUsedToday: countEmailsUsedToday,
    dailyLimit: env.emailDailyLimit,
    buildNotice: buildResendNotice,
    send: notifyAccess,
    markResolved: markEmailsResolved,
  })
}

async function sendReenvio(storeId: string, customerId: string): Promise<NoticeOutcome | NoticeResult> {
  if ((await countEmailsUsedToday()) >= env.emailDailyLimit) return { ok: false, error: 'Limite diário de e-mails atingido.' }
  const notice = await buildResendNotice({ storeId, customerId })
  if (!notice) return { ok: false, error: 'Cliente sem produtos liberados nesta loja.' }
  return notifyAccess(notice)
}

export async function resendEmailLogEntry(logId: string): Promise<NoticeResult> {
  const entry = await getEmailLogEntry(logId)
  if (!entry || !entry.storeId || !entry.customerId) return { ok: false, error: 'Registro sem loja ou cliente.' }
  const result = await sendReenvio(entry.storeId, entry.customerId)
  if (result.ok && 'logId' in result) await markEmailsResolved([logId], result.logId)
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

export async function resendAccessForCustomer(customerId: string, storeId: string): Promise<NoticeResult> {
  const result = await sendReenvio(storeId, customerId)
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}
```

- [ ] **Step 11: Reenvio da ficha do cliente usa o notificador**

Em `src/app/admin/(painel)/clientes/actions.ts`, trocar os imports por:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { changeCustomerEmail, setCustomerBlocked } from '@/lib/data/customers'
import { getDefaultStore } from '@/lib/data/stores'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'
import { resendAccessForCustomer } from '@/lib/email/server'
```

E substituir a função `reenviarAcesso` por:

```ts
export async function reenviarAcesso(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  const store = await getDefaultStore()
  const result = await resendAccessForCustomer(id, store.id)
  back(id, result.ok ? 'E-mail de acesso reenviado.' : `Falha ao enviar: ${result.error}`)
}
```

- [ ] **Step 12: Verificar tudo**

Run: `npm test` → Expected: PASS.
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: concluído.

- [ ] **Step 13: Commit**

```bash
git add src/lib/email src/lib/data/email-log.ts "src/app/admin/(painel)/clientes/actions.ts" tests/email
git commit -m "feat: registro de e-mails com status e reenvio em lote respeitando o limite diário"
```

---

### Task 3: Payt com bumps no mesmo aviso

**Executor:** Codex (frente A). Requer Task 2 na mesma branch.

**Files:**
- Create: `tests/fixtures/payt-paid-bumps.json`
- Modify: `src/lib/payt/parse.ts` (arquivo inteiro)
- Modify: `src/lib/orders/process-postback.ts` (arquivo inteiro)
- Modify: `src/lib/data/postback-repo.ts` (arquivo inteiro)
- Modify: `src/app/api/webhooks/payt/route.ts` (arquivo inteiro)
- Modify: `src/lib/data/orders.ts` (remover `getMaterialTitlesForProduct`)
- Modify: `tests/payt/parse.test.ts`, `tests/orders/process-postback.test.ts`, `tests/helpers/fakes.ts` (arquivos inteiros)
- Delete: `src/lib/email/resend-mailer.ts`, `src/lib/email/templates.ts`, `tests/email/templates.test.ts`

**Interfaces:**
- Consumes: `StoreRef`, `AccessNotice`, `NoticeResult` (Task 1); `findStoreForProductCode`, `getProductsForCode` (Task 1); `notifyAccess` (Task 2).
- Produces:
  - `@/lib/payt/parse`: `type PaytProductLine = { code: string; name: string; amountCents: number | null }`, `type PaytPostback` com `products: PaytProductLine[]`.
  - `@/lib/orders/process-postback`: `type EventOutcome = 'chave_invalida' | 'invalido' | 'ignorado' | 'liberado' | 'atualizado' | 'sem_mudanca' | 'codigo_desconhecido' | 'erro'`, `type EventFinish`, `interface PostbackRepo`, `processPostback(body, { repo, notify, integrationKey })`.
  - Colunas `payt_events.customer_email`, `product_codes`, `payt_status`, `outcome` preenchidas (lidas na Task 10).

- [ ] **Step 1: Criar a fixture com bumps**

Criar `tests/fixtures/payt-paid-bumps.json`:

```json
{
  "integration_key": "chave-de-teste",
  "transaction_id": "TX200",
  "seller_id": "S1",
  "status": "paid",
  "type": "order",
  "test": false,
  "tangible": false,
  "customer": { "name": "João Silva", "email": " Joao@Gmail.com " },
  "product": {
    "name": "Atlas Visual - Plano Completo",
    "code": "ATLAS-COMPLETO",
    "price": 4700,
    "quantity": 1,
    "items": [{ "name": "Checklist de Vistoria", "code": "BUMP-CHECKLIST", "price": 1700 }]
  },
  "order_bumps": [
    { "name": "Pack de Detalhes", "code": "BUMP-PACK", "price": 1900 },
    { "name": "Checklist de Vistoria", "code": "BUMP-CHECKLIST", "price": 1700 }
  ]
}
```

- [ ] **Step 2: Reescrever `tests/payt/parse.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { parsePaytPostback } from '@/lib/payt/parse'
import bumps from '../fixtures/payt-paid-bumps.json'
import paid from '../fixtures/payt-paid.json'

describe('parsePaytPostback', () => {
  it('extrai os campos usados pelo sistema', () => {
    expect(parsePaytPostback(paid)).toEqual({
      ok: true,
      value: {
        transactionId: 'TX123',
        status: 'paid',
        type: 'order',
        isTest: false,
        customerEmail: 'joao@gmail.com',
        customerName: 'João Silva',
        products: [{ code: 'ATLAS-COMPLETO', name: 'Atlas Visual - Plano Completo', amountCents: 4700 }],
      },
    })
  })

  it('usa o sku quando não há code e aceita ids numéricos', () => {
    const result = parsePaytPostback({ ...paid, transaction_id: 987, product: { name: 'X', sku: 555 } })
    expect(result.ok && result.value.products[0].code).toBe('555')
    expect(result.ok && result.value.transactionId).toBe('987')
  })

  it('entende test como texto', () => {
    const result = parsePaytPostback({ ...paid, test: 'true' })
    expect(result.ok && result.value.isTest).toBe(true)
  })

  it('falha sem email válido', () => {
    expect(parsePaytPostback({ ...paid, customer: { name: 'X', email: 'sem-email' } }).ok).toBe(false)
  })

  it('falha sem código de produto', () => {
    expect(parsePaytPostback({ ...paid, product: { name: 'X' } })).toEqual({ ok: false, error: 'produto sem code/sku' })
  })

  it('inclui bumps de product.items e order_bumps sem repetir códigos', () => {
    const result = parsePaytPostback(bumps)
    expect(result.ok && result.value.products).toEqual([
      { code: 'ATLAS-COMPLETO', name: 'Atlas Visual - Plano Completo', amountCents: 4700 },
      { code: 'BUMP-CHECKLIST', name: 'Checklist de Vistoria', amountCents: 1700 },
      { code: 'BUMP-PACK', name: 'Pack de Detalhes', amountCents: 1900 },
    ])
  })

  it('ignora bump sem código ou fora do formato', () => {
    const result = parsePaytPostback({ ...paid, order_bumps: [{ name: 'Sem código', price: 900 }, 'lixo', null] })
    expect(result.ok && result.value.products.map((p) => p.code)).toEqual(['ATLAS-COMPLETO'])
  })

  it('aceita order_bumps que não é lista', () => {
    const result = parsePaytPostback({ ...paid, order_bumps: 'nenhum' })
    expect(result.ok && result.value.products).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/payt/parse.test.ts`
Expected: FAIL — `products` ausente no resultado.

- [ ] **Step 4: Reescrever `src/lib/payt/parse.ts`**

```ts
import { z } from 'zod'
import { normalizeEmail } from '@/lib/domain/email'

export type PaytProductLine = { code: string; name: string; amountCents: number | null }

export type PaytPostback = {
  transactionId: string
  status: string
  type: string
  isTest: boolean
  customerEmail: string
  customerName: string
  products: PaytProductLine[]
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
    items: z.unknown().optional(),
  }),
  order_bumps: z.unknown().optional(),
})

function lineFrom(value: unknown): PaytProductLine | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const raw = v.code ?? v.sku ?? v.id
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const code = String(raw).trim()
  if (!code) return null
  return {
    code,
    name: typeof v.name === 'string' ? v.name : '',
    amountCents: typeof v.price === 'number' ? v.price : null,
  }
}

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

export function parsePaytPostback(body: unknown): { ok: true; value: PaytPostback } | { ok: false; error: string } {
  const parsed = schema.safeParse(body)
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) }

  const data = parsed.data
  const mainCode = (data.product.code ?? data.product.sku)?.trim()
  if (!mainCode) return { ok: false, error: 'produto sem code/sku' }

  const candidates: PaytProductLine[] = [
    { code: mainCode, name: data.product.name ?? '', amountCents: data.product.price ?? null },
    ...[...asList(data.product.items), ...asList(data.order_bumps)]
      .map(lineFrom)
      .filter((line): line is PaytProductLine => line !== null),
  ]
  const seen = new Set<string>()
  const products = candidates.filter((line) => (seen.has(line.code) ? false : (seen.add(line.code), true)))

  return {
    ok: true,
    value: {
      transactionId: data.transaction_id,
      status: data.status,
      type: data.type ?? 'order',
      isTest: data.test === true || data.test === 'true' || data.test === 1 || data.test === '1',
      customerEmail: data.customer.email,
      customerName: data.customer.name?.trim() ?? '',
      products,
    },
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/payt/parse.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 6: Reescrever `tests/helpers/fakes.ts`**

```ts
import {
  STATUS_RANK,
  type AccessNotice,
  type CustomerRow,
  type NoticeResult,
  type OrderStatus,
  type StoreRef,
} from '@/lib/domain/types'
import type { ApplyOrderInput, EventFinish, PostbackRepo } from '@/lib/orders/process-postback'

export const ARQ: StoreRef = { id: 'store-1', slug: 'arquitetura', name: 'Arquitetura' }

type FakeOrder = ApplyOrderInput & { id: string }

export class FakeRepo implements PostbackRepo {
  storesByCode: Record<string, StoreRef> = { 'ATLAS-COMPLETO': ARQ, 'BUMP-CHECKLIST': ARQ, 'BUMP-PACK': ARQ }
  productsByCode: Record<string, { id: string; title: string }[]> = {
    'ATLAS-COMPLETO': [{ id: 'p-atlas', title: 'Atlas Visual' }, { id: 'p-bonus1', title: 'Bônus 1' }],
    'BUMP-CHECKLIST': [{ id: 'p-check', title: 'Checklist de Vistoria' }],
    'BUMP-PACK': [{ id: 'p-pack', title: 'Pack de Detalhes' }],
  }
  events: ({ id: string; payload: unknown } & Partial<EventFinish>)[] = []
  orders: FakeOrder[] = []
  customers: CustomerRow[] = []
  failCreateCustomerTimes = 0
  hideCustomerFromLookupOnce = false

  async logEvent(payload: unknown) {
    const id = `ev-${this.events.length + 1}`
    this.events.push({ id, payload })
    return id
  }
  async finishEvent(id: string, result: EventFinish) {
    Object.assign(this.events.find((e) => e.id === id)!, result)
  }
  async findStoreForProductCode(code: string) {
    return this.storesByCode[code] ?? null
  }
  async applyOrderStatus(input: ApplyOrderInput) {
    const existing = this.orders.find((o) => o.transactionId === input.transactionId && o.productCode === input.productCode)
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
    if (this.hideCustomerFromLookupOnce) {
      this.hideCustomerFromLookupOnce = false
      return null
    }
    return this.customers.find((c) => c.email === email) ?? null
  }
  async createCustomer(email: string, name: string) {
    if (this.failCreateCustomerTimes > 0) {
      this.failCreateCustomerTimes--
      throw new Error('auth indisponível')
    }
    const existing = this.customers.find((c) => c.email === email)
    if (existing) return { customer: existing, created: false }
    const customer = { id: `cus-${this.customers.length + 1}`, email, name, blockedAt: null }
    this.customers.push(customer)
    return { customer, created: true }
  }
  async getProductsForCode(code: string) {
    return this.productsByCode[code] ?? []
  }
}

export class FakeNotifier {
  sent: AccessNotice[] = []
  fail = false
  notify = async (notice: AccessNotice): Promise<NoticeResult> => {
    if (this.fail) return { ok: false, error: 'resend fora do ar' }
    this.sent.push(notice)
    return { ok: true }
  }
}
```

- [ ] **Step 7: Reescrever `tests/orders/process-postback.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { processPostback } from '@/lib/orders/process-postback'
import bumps from '../fixtures/payt-paid-bumps.json'
import paid from '../fixtures/payt-paid.json'
import { ARQ, FakeNotifier, FakeRepo } from '../helpers/fakes'

const KEY = 'chave-de-teste'
let repo: FakeRepo
let notifier: FakeNotifier

function run(body: unknown) {
  return processPostback(body, { repo, notify: notifier.notify, integrationKey: KEY })
}
const withStatus = (status: string, extra: object = {}) => ({ ...paid, status, ...extra })

beforeEach(() => {
  repo = new FakeRepo()
  notifier = new FakeNotifier()
})

describe('processPostback', () => {
  it('recusa chave de integração inválida e registra o evento', async () => {
    expect(await run({ ...paid, integration_key: 'errada' })).toEqual({ kind: 'unauthorized' })
    expect(repo.orders).toHaveLength(0)
    expect(repo.events[0]).toMatchObject({ keyValid: false, outcome: 'chave_invalida' })
  })

  it('recusa payload sem chave', async () => {
    expect(await run({ status: 'paid' })).toEqual({ kind: 'unauthorized' })
  })

  it('compra paga de email novo cria cliente e envia primeiro acesso', async () => {
    const result = await run(paid)
    expect(result).toMatchObject({ kind: 'processed', outcome: 'liberado', status: 'pago', customerCreated: true, emailsSent: 1, unknownCodes: [] })
    expect(repo.customers).toEqual([{ id: 'cus-1', email: 'joao@gmail.com', name: 'João Silva', blockedAt: null }])
    expect(notifier.sent).toEqual([
      {
        customerId: 'cus-1',
        to: 'joao@gmail.com',
        customerName: 'João Silva',
        store: ARQ,
        products: [{ id: 'p-atlas', title: 'Atlas Visual' }, { id: 'p-bonus1', title: 'Bônus 1' }],
        kind: 'acesso_novo',
      },
    ])
    expect(repo.events[0]).toMatchObject({
      keyValid: true, outcome: 'liberado', customerEmail: 'joao@gmail.com', productCodes: ['ATLAS-COMPLETO'], paytStatus: 'paid',
    })
    expect(repo.orders[0]).toMatchObject({ storeId: 'store-1', productCode: 'ATLAS-COMPLETO', amountCents: 4700 })
  })

  it('aviso repetido não duplica cliente nem email', async () => {
    await run(paid)
    expect(await run(paid)).toMatchObject({ outcome: 'sem_mudanca', customerCreated: false, emailsSent: 0 })
    expect(repo.customers).toHaveLength(1)
    expect(notifier.sent).toHaveLength(1)
  })

  it('aviso pendente atrasado não retrocede pedido pago', async () => {
    await run(paid)
    expect(await run(withStatus('waiting_payment'))).toMatchObject({ status: 'pago', outcome: 'sem_mudanca' })
    expect(notifier.sent).toHaveLength(1)
  })

  it('reembolso vale e pago atrasado não devolve acesso', async () => {
    await run(paid)
    expect(await run(withStatus('refunded'))).toMatchObject({ status: 'reembolsado', outcome: 'atualizado', emailsSent: 0 })
    expect(await run(paid)).toMatchObject({ status: 'reembolsado', outcome: 'sem_mudanca', emailsSent: 0 })
    expect(notifier.sent).toHaveLength(1)
  })

  it('chargeback muda o status sem email', async () => {
    await run(paid)
    expect(await run(withStatus('chargeback'))).toMatchObject({ status: 'chargeback', emailsSent: 0 })
  })

  it('cliente existente comprando outra oferta recebe email de produto novo', async () => {
    await run(paid)
    await run({ ...paid, transaction_id: 'TX999', product: { name: 'Pack', code: 'BUMP-PACK' } })
    expect(notifier.sent[1]).toMatchObject({ kind: 'produto_novo', products: [{ id: 'p-pack', title: 'Pack de Detalhes' }] })
    expect(repo.customers).toHaveLength(1)
  })

  it('pedido pendente de email novo não cria cliente', async () => {
    expect(await run(withStatus('waiting_payment'))).toMatchObject({ status: 'pendente', customerCreated: false, emailsSent: 0 })
    expect(repo.customers).toHaveLength(0)
  })

  it('status irrelevante é ignorado sem criar pedido', async () => {
    expect(await run(withStatus('lost_cart'))).toEqual({ kind: 'ignored', reason: 'lost_cart' })
    expect(repo.orders).toHaveLength(0)
    expect(repo.events[0]).toMatchObject({ outcome: 'ignorado', paytStatus: 'lost_cart' })
  })

  it('payload inválido com chave certa é registrado', async () => {
    const result = await run({ ...paid, customer: { name: 'X', email: 'x' } })
    expect(result.kind).toBe('invalid')
    expect(repo.events[0]).toMatchObject({ keyValid: true, outcome: 'invalido' })
  })

  it('falha no email não desfaz o pedido e fica registrada', async () => {
    notifier.fail = true
    const result = await run(paid)
    expect(result).toMatchObject({ outcome: 'liberado', status: 'pago', customerCreated: true, emailsSent: 0, emailErrors: ['resend fora do ar'] })
    expect(repo.events[0]).toMatchObject({ outcome: 'liberado', error: 'falha no email: resend fora do ar' })
  })

  it('se criar o cliente falhar, a nova tentativa cria e envia o email', async () => {
    repo.failCreateCustomerTimes = 1
    await expect(run(paid)).rejects.toThrow('auth indisponível')
    expect(repo.events[0]).toMatchObject({ outcome: 'erro', error: 'auth indisponível' })

    expect(await run(paid)).toMatchObject({ customerCreated: true, emailsSent: 1 })
    expect(notifier.sent).toHaveLength(1)
  })

  it('cliente criado ao mesmo tempo por outro aviso não recebe boas-vindas duplicado', async () => {
    repo.customers.push({ id: 'cus-existente', email: 'joao@gmail.com', name: 'João Silva', blockedAt: null })
    repo.hideCustomerFromLookupOnce = true
    expect(await run(paid)).toMatchObject({ customerCreated: false, emailsSent: 1 })
    expect(notifier.sent[0]).toMatchObject({ kind: 'produto_novo', customerId: 'cus-existente' })
    expect(repo.customers).toHaveLength(1)
  })

  it('aviso com bumps libera principal e bumps num único email', async () => {
    const result = await run(bumps)
    expect(result).toMatchObject({ outcome: 'liberado', emailsSent: 1 })
    expect(repo.orders.map((o) => [o.productCode, o.status])).toEqual([
      ['ATLAS-COMPLETO', 'pago'],
      ['BUMP-CHECKLIST', 'pago'],
      ['BUMP-PACK', 'pago'],
    ])
    expect(notifier.sent).toHaveLength(1)
    expect(notifier.sent[0].products.map((p) => p.id)).toEqual(['p-atlas', 'p-bonus1', 'p-check', 'p-pack'])
  })

  it('reembolso só do bump mantém o principal', async () => {
    await run(bumps)
    await run({ ...paid, transaction_id: 'TX200', status: 'refunded', product: { name: 'Pack de Detalhes', code: 'BUMP-PACK' } })
    expect(repo.orders.map((o) => [o.productCode, o.status])).toEqual([
      ['ATLAS-COMPLETO', 'pago'],
      ['BUMP-CHECKLIST', 'pago'],
      ['BUMP-PACK', 'reembolsado'],
    ])
  })

  it('código desconhecido fica registrado sem travar o resto', async () => {
    const result = await run({ ...bumps, order_bumps: [{ name: 'Novo', code: 'DESCONHECIDO', price: 500 }] })
    expect(result).toMatchObject({ outcome: 'liberado', unknownCodes: ['DESCONHECIDO'], emailsSent: 1 })
    expect(repo.orders.find((o) => o.productCode === 'DESCONHECIDO')).toMatchObject({ storeId: null, status: 'pago' })
    expect(repo.events[0].error).toBe('códigos desconhecidos: DESCONHECIDO')
  })

  it('só código desconhecido cria o cliente mas não envia email', async () => {
    const result = await run({ ...paid, product: { name: 'Outro nicho', code: 'NADA' } })
    expect(result).toMatchObject({ outcome: 'codigo_desconhecido', emailsSent: 0, unknownCodes: ['NADA'] })
    expect(repo.customers).toHaveLength(1)
    expect(notifier.sent).toHaveLength(0)
  })
})
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `npx vitest run tests/orders/process-postback.test.ts`
Expected: FAIL — tipos/assinatura de `processPostback` ainda antigos.

- [ ] **Step 9: Reescrever `src/lib/orders/process-postback.ts`**

```ts
import { timingSafeEqual } from 'node:crypto'
import type { AccessNotice, CustomerRow, NoticeResult, OrderStatus, StoreRef } from '@/lib/domain/types'
import { parsePaytPostback, type PaytProductLine } from '@/lib/payt/parse'
import { mapPaytStatus } from '@/lib/payt/status'

export type ApplyOrderInput = {
  storeId: string | null
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

export type EventOutcome =
  | 'chave_invalida'
  | 'invalido'
  | 'ignorado'
  | 'liberado'
  | 'atualizado'
  | 'sem_mudanca'
  | 'codigo_desconhecido'
  | 'erro'

export type EventFinish = {
  keyValid: boolean
  outcome: EventOutcome
  error?: string
  customerEmail?: string
  productCodes?: string[]
  paytStatus?: string
}

export interface PostbackRepo {
  logEvent(payload: unknown): Promise<string>
  finishEvent(id: string, result: EventFinish): Promise<void>
  findStoreForProductCode(code: string): Promise<StoreRef | null>
  applyOrderStatus(input: ApplyOrderInput): Promise<{ orderId: string; changed: boolean; status: OrderStatus }>
  findCustomerByEmail(email: string): Promise<CustomerRow | null>
  // created = false quando outro aviso simultâneo criou o cliente primeiro.
  createCustomer(email: string, name: string): Promise<{ customer: CustomerRow; created: boolean }>
  getProductsForCode(code: string): Promise<{ id: string; title: string }[]>
}

export type ProcessedLine = { code: string; storeId: string | null; orderId: string; changed: boolean; status: OrderStatus }

export type ProcessResult =
  | { kind: 'unauthorized' }
  | { kind: 'invalid'; error: string }
  | { kind: 'ignored'; reason: string }
  | {
      kind: 'processed'
      outcome: 'liberado' | 'atualizado' | 'sem_mudanca' | 'codigo_desconhecido'
      status: OrderStatus
      lines: ProcessedLine[]
      unknownCodes: string[]
      customerCreated: boolean
      emailsSent: number
      emailErrors: string[]
    }

type Line = { product: PaytProductLine; store: StoreRef | null; orderId: string; changed: boolean; status: OrderStatus }

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

function storesOf(lines: Line[]): StoreRef[] {
  const stores = new Map<string, StoreRef>()
  for (const line of lines) if (line.store) stores.set(line.store.id, line.store)
  return [...stores.values()]
}

async function productsFor(repo: PostbackRepo, lines: Line[]): Promise<{ id: string; title: string }[]> {
  const products = new Map<string, { id: string; title: string }>()
  for (const line of lines) {
    for (const product of await repo.getProductsForCode(line.product.code)) {
      if (!products.has(product.id)) products.set(product.id, product)
    }
  }
  return [...products.values()]
}

export async function processPostback(
  body: unknown,
  deps: { repo: PostbackRepo; notify(notice: AccessNotice): Promise<NoticeResult>; integrationKey: string },
): Promise<ProcessResult> {
  const { repo } = deps
  const eventId = await repo.logEvent(body)

  if (!keyMatches(body, deps.integrationKey)) {
    await repo.finishEvent(eventId, { keyValid: false, outcome: 'chave_invalida' })
    return { kind: 'unauthorized' }
  }

  const parsed = parsePaytPostback(body)
  if (!parsed.ok) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'invalido', error: parsed.error })
    return { kind: 'invalid', error: parsed.error }
  }
  const p = parsed.value
  const summary = { customerEmail: p.customerEmail, productCodes: p.products.map((x) => x.code), paytStatus: p.status }

  const status = mapPaytStatus(p.status)
  if (!status) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'ignorado', error: `status ignorado: ${p.status}`, ...summary })
    return { kind: 'ignored', reason: p.status }
  }

  try {
    const lines: Line[] = []
    for (const product of p.products) {
      const store = await repo.findStoreForProductCode(product.code)
      const order = await repo.applyOrderStatus({
        storeId: store?.id ?? null,
        transactionId: p.transactionId,
        productCode: product.code,
        productName: product.name,
        customerEmail: p.customerEmail,
        customerName: p.customerName,
        status,
        paytType: p.type,
        isTest: p.isTest,
        amountCents: product.amountCents,
      })
      lines.push({ product, store, orderId: order.orderId, changed: order.changed, status: order.status })
    }

    const unknownCodes = lines.filter((l) => !l.store).map((l) => l.product.code)
    const paid = lines.filter((l) => l.status === 'pago')
    let customerCreated = false
    let emailsSent = 0
    let granted = false
    const emailErrors: string[] = []

    if (paid.length > 0) {
      let customer = await repo.findCustomerByEmail(p.customerEmail)
      if (!customer) {
        const created = await repo.createCustomer(p.customerEmail, p.customerName)
        customer = created.customer
        customerCreated = created.created
      }

      for (const store of storesOf(paid)) {
        const storeLines = paid.filter((l) => l.store?.id === store.id)
        if (!customerCreated && !storeLines.some((l) => l.changed)) continue
        granted = true
        const products = await productsFor(repo, storeLines)
        if (products.length === 0) continue
        const result = await deps.notify({
          customerId: customer.id,
          to: p.customerEmail,
          customerName: p.customerName,
          store,
          products,
          kind: customerCreated ? 'acesso_novo' : 'produto_novo',
        })
        if (result.ok) emailsSent++
        else emailErrors.push(result.error)
      }
    }

    const outcome = granted
      ? 'liberado'
      : lines.some((l) => l.store && l.changed)
        ? 'atualizado'
        : unknownCodes.length === lines.length
          ? 'codigo_desconhecido'
          : 'sem_mudanca'
    const errors = [
      ...(unknownCodes.length ? [`códigos desconhecidos: ${unknownCodes.join(', ')}`] : []),
      ...emailErrors.map((e) => `falha no email: ${e}`),
    ]

    await repo.finishEvent(eventId, {
      keyValid: true,
      outcome,
      ...summary,
      ...(errors.length ? { error: errors.join(' | ') } : {}),
    })

    return {
      kind: 'processed',
      outcome,
      status: lines[0].status,
      lines: lines.map((l) => ({ code: l.product.code, storeId: l.store?.id ?? null, orderId: l.orderId, changed: l.changed, status: l.status })),
      unknownCodes,
      customerCreated,
      emailsSent,
      emailErrors,
    }
  } catch (e) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'erro', error: errorMessage(e), ...summary })
    throw e
  }
}
```

- [ ] **Step 10: Rodar e ver passar**

Run: `npx vitest run tests/orders/process-postback.test.ts tests/payt`
Expected: PASS.

- [ ] **Step 11: Reescrever `src/lib/data/postback-repo.ts`**

```ts
import { STATUS_RANK, type OrderStatus } from '@/lib/domain/types'
import type { PostbackRepo } from '@/lib/orders/process-postback'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCustomer, findCustomerByEmail } from './customers'
import { findStoreForProductCode, getProductsForCode } from './products'

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
          customer_email: result.customerEmail ?? null,
          product_codes: result.productCodes ?? [],
          payt_status: result.paytStatus ?? null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },

    findStoreForProductCode,

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
    getProductsForCode,
  }
}
```

- [ ] **Step 12: Reescrever `src/app/api/webhooks/payt/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createPostbackRepo } from '@/lib/data/postback-repo'
import { notifyAccess } from '@/lib/email/server'
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
      notify: notifyAccess,
      integrationKey: env.paytIntegrationKey,
    })
    if (result.kind === 'unauthorized') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
    if (result.kind === 'invalid') return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true, result: result.kind === 'processed' ? result.outcome : result.kind })
  } catch {
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 13: Remover código antigo de e-mail e títulos de material**

```bash
git rm src/lib/email/resend-mailer.ts src/lib/email/templates.ts tests/email/templates.test.ts
```

Em `src/lib/data/orders.ts`, apagar a função `getMaterialTitlesForProduct` inteira (linhas 14–31 do arquivo original).

Run: `git grep -n "resend-mailer\|email/templates\|getMaterialTitlesForProduct\|sendAccessGranted"` → Expected: nenhuma ocorrência em `src/` ou `tests/`.

- [ ] **Step 14: Verificar tudo**

Run: `npm test` → Expected: PASS.
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: concluído.

- [ ] **Step 15: Commit**

```bash
git add -A src/lib/payt src/lib/orders src/lib/data/postback-repo.ts src/lib/data/orders.ts src/app/api/webhooks/payt/route.ts src/lib/email tests
git commit -m "feat: webhook da Payt libera produto principal e bumps do mesmo aviso"
```

---

### Task 4: Lógica de sucesso do cliente (classificação, resumo, linha do tempo e dados)

**Executor:** Codex (frente A).

**Files:**
- Create: `src/lib/success/classify.ts`, `src/lib/success/timeline.ts`, `src/lib/data/success.ts`
- Create: `tests/success/classify.test.ts`, `tests/success/timeline.test.ts`

**Interfaces:**
- Consumes: função SQL `store_customer_success` (Task 1); tabelas `email_log`, `item_access`.
- Produces:
  - `@/lib/success/classify`: `type SuccessStatus = 'nunca_entrou' | 'nao_abriu' | 'ativo' | 'inativo'`, `type SuccessRow`, `classifyCustomer(row, now): SuccessStatus`, `type SuccessOverview = { buyers; loggedInPct; openedPct }`, `summarizeSuccess(rows, now, periodDays)`.
  - `@/lib/success/timeline`: `type TimelineEvent = { at; kind: 'pedido' | 'email' | 'acesso' | 'item'; title; detail }`, `type TimelineInput`, `buildTimeline(input): TimelineEvent[]`.
  - `@/lib/data/success`: `loadSuccessRows(storeId): Promise<SuccessRow[]>`, `countFailedEmailsSince(storeId, sinceIso): Promise<number>`, `listEmailsForCustomer(customerId)`, `listItemOpensForCustomer(customerId)`.

- [ ] **Step 1: Escrever os testes**

Criar `tests/success/classify.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { classifyCustomer, summarizeSuccess, type SuccessRow } from '@/lib/success/classify'

const now = new Date('2026-09-17T12:00:00Z')

function row(extra: Partial<SuccessRow>): SuccessRow {
  return {
    customerId: 'c1', email: 'a@b.com', firstPaidAt: '2026-09-10T12:00:00Z', paidOrders: 1,
    lastSeenAt: null, itemOpens: 0, lastItemOpenAt: null, ...extra,
  }
}

describe('classifyCustomer', () => {
  it('nunca entrou quando comprou há mais de 24h e não tem acesso', () => {
    expect(classifyCustomer(row({}), now)).toBe('nunca_entrou')
  })

  it('compra recente sem login ainda não conta como nunca entrou', () => {
    expect(classifyCustomer(row({ firstPaidAt: '2026-09-17T02:00:00Z' }), now)).toBe('inativo')
  })

  it('entrou e não abriu nada', () => {
    expect(classifyCustomer(row({ lastSeenAt: '2026-09-11T00:00:00Z' }), now)).toBe('nao_abriu')
  })

  it('ativo quando abriu item nos últimos 30 dias', () => {
    expect(
      classifyCustomer(row({ lastSeenAt: '2026-09-11T00:00:00Z', itemOpens: 3, lastItemOpenAt: '2026-09-01T00:00:00Z' }), now),
    ).toBe('ativo')
  })

  it('inativo quando a última abertura passou de 30 dias', () => {
    expect(
      classifyCustomer(
        row({ firstPaidAt: '2026-07-01T00:00:00Z', lastSeenAt: '2026-07-02T00:00:00Z', itemOpens: 2, lastItemOpenAt: '2026-07-02T00:00:00Z' }),
        now,
      ),
    ).toBe('inativo')
  })
})

describe('summarizeSuccess', () => {
  it('calcula compradores do período e percentuais', () => {
    const rows = [
      row({}),
      row({ customerId: 'c2', lastSeenAt: '2026-09-11T00:00:00Z' }),
      row({ customerId: 'c3', lastSeenAt: '2026-09-11T00:00:00Z', itemOpens: 1, lastItemOpenAt: '2026-09-12T00:00:00Z' }),
      row({ customerId: 'c4', firstPaidAt: '2026-06-01T00:00:00Z' }),
    ]
    expect(summarizeSuccess(rows, now, 30)).toEqual({ buyers: 3, loggedInPct: 67, openedPct: 33 })
  })

  it('período sem compradores dá zero', () => {
    expect(summarizeSuccess([], now, 7)).toEqual({ buyers: 0, loggedInPct: 0, openedPct: 0 })
  })
})
```

Criar `tests/success/timeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildTimeline } from '@/lib/success/timeline'

const empty = { orders: [], emails: [], devices: [], itemOpens: [] }

describe('buildTimeline', () => {
  it('junta pedidos, e-mails, acessos e itens do mais recente para o mais antigo', () => {
    const events = buildTimeline({
      orders: [{ createdAt: '2026-09-10T10:00:00Z', productName: 'Atlas', productCode: 'ATLAS', status: 'pago' }],
      emails: [{ createdAt: '2026-09-10T10:00:05Z', kind: 'acesso_novo', status: 'falhou', error: 'domínio' }],
      devices: [
        { firstSeenAt: '2026-09-11T08:00:00Z', lastSeenAt: '2026-09-12T08:00:00Z' },
        { firstSeenAt: '2026-09-11T09:00:00Z', lastSeenAt: '2026-09-11T09:00:00Z' },
      ],
      itemOpens: [{ createdAt: '2026-09-11T08:05:00Z', itemTitle: 'Capítulo 1', productTitle: 'Atlas' }],
    })
    expect(events.map((e) => [e.kind, e.title])).toEqual([
      ['acesso', 'Último acesso'],
      ['item', 'Abriu "Capítulo 1"'],
      ['acesso', 'Primeiro acesso'],
      ['email', 'E-mail: acesso chegou'],
      ['pedido', 'Pedido pago: Atlas'],
    ])
    expect(events[3].detail).toBe('falhou — domínio')
    expect(events[1].detail).toBe('Atlas')
  })

  it('sem acessos não cria eventos de acesso', () => {
    expect(buildTimeline(empty)).toEqual([])
  })

  it('primeiro e último acesso iguais viram um evento só', () => {
    const events = buildTimeline({ ...empty, devices: [{ firstSeenAt: '2026-09-11T08:00:00Z', lastSeenAt: '2026-09-11T08:00:00Z' }] })
    expect(events.map((e) => e.title)).toEqual(['Primeiro acesso'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/success`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar `src/lib/success/classify.ts`**

```ts
export type SuccessStatus = 'nunca_entrou' | 'nao_abriu' | 'ativo' | 'inativo'

export type SuccessRow = {
  customerId: string
  email: string
  firstPaidAt: string
  paidOrders: number
  lastSeenAt: string | null
  itemOpens: number
  lastItemOpenAt: string | null
}

const DAY_MS = 86_400_000

export function classifyCustomer(row: SuccessRow, now: Date): SuccessStatus {
  const t = now.getTime()
  if (!row.lastSeenAt) return t - Date.parse(row.firstPaidAt) > DAY_MS ? 'nunca_entrou' : 'inativo'
  if (row.itemOpens === 0) return 'nao_abriu'
  if (row.lastItemOpenAt && t - Date.parse(row.lastItemOpenAt) <= 30 * DAY_MS) return 'ativo'
  return 'inativo'
}

export type SuccessOverview = { buyers: number; loggedInPct: number; openedPct: number }

export function summarizeSuccess(rows: SuccessRow[], now: Date, periodDays: number): SuccessOverview {
  const since = now.getTime() - periodDays * DAY_MS
  const inPeriod = rows.filter((r) => Date.parse(r.firstPaidAt) >= since)
  const pct = (n: number) => (inPeriod.length ? Math.round((n / inPeriod.length) * 100) : 0)
  return {
    buyers: inPeriod.length,
    loggedInPct: pct(inPeriod.filter((r) => r.lastSeenAt).length),
    openedPct: pct(inPeriod.filter((r) => r.itemOpens > 0).length),
  }
}
```

- [ ] **Step 4: Implementar `src/lib/success/timeline.ts`**

```ts
export type TimelineEvent = { at: string; kind: 'pedido' | 'email' | 'acesso' | 'item'; title: string; detail: string }

export type TimelineInput = {
  orders: { createdAt: string; productName: string; productCode: string; status: string }[]
  emails: { createdAt: string; kind: string; status: string; error: string | null }[]
  devices: { firstSeenAt: string; lastSeenAt: string }[]
  itemOpens: { createdAt: string; itemTitle: string; productTitle: string }[]
}

const EMAIL_LABEL: Record<string, string> = {
  acesso_novo: 'acesso chegou',
  produto_novo: 'produto novo',
  reenvio: 'reenvio de acesso',
}

export function buildTimeline(input: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const o of input.orders) {
    events.push({ at: o.createdAt, kind: 'pedido', title: `Pedido ${o.status}: ${o.productName || o.productCode}`, detail: o.productCode })
  }
  for (const e of input.emails) {
    events.push({
      at: e.createdAt,
      kind: 'email',
      title: `E-mail: ${EMAIL_LABEL[e.kind] ?? e.kind}`,
      detail: e.error ? `${e.status} — ${e.error}` : e.status,
    })
  }
  if (input.devices.length > 0) {
    const first = input.devices.map((d) => d.firstSeenAt).sort((a, b) => Date.parse(a) - Date.parse(b))[0]
    const last = input.devices.map((d) => d.lastSeenAt).sort((a, b) => Date.parse(b) - Date.parse(a))[0]
    events.push({ at: first, kind: 'acesso', title: 'Primeiro acesso', detail: '' })
    if (Date.parse(last) !== Date.parse(first)) events.push({ at: last, kind: 'acesso', title: 'Último acesso', detail: '' })
  }
  for (const i of input.itemOpens) {
    events.push({ at: i.createdAt, kind: 'item', title: `Abriu "${i.itemTitle}"`, detail: i.productTitle })
  }

  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/success`
Expected: PASS (10 testes).

- [ ] **Step 6: Implementar `src/lib/data/success.ts`**

```ts
import type { SuccessRow } from '@/lib/success/classify'
import { createAdminClient } from '@/lib/supabase/admin'

type DbSuccessRow = {
  customer_id: string
  email: string
  first_paid_at: string
  paid_orders: number
  last_seen_at: string | null
  item_opens: number
  last_item_open_at: string | null
}

export async function loadSuccessRows(storeId: string): Promise<SuccessRow[]> {
  const { data, error } = await createAdminClient().rpc('store_customer_success', { p_store_id: storeId })
  if (error) throw error
  return (data as DbSuccessRow[]).map((r) => ({
    customerId: r.customer_id,
    email: r.email,
    firstPaidAt: r.first_paid_at,
    paidOrders: r.paid_orders,
    lastSeenAt: r.last_seen_at,
    itemOpens: r.item_opens,
    lastItemOpenAt: r.last_item_open_at,
  }))
}

export async function countFailedEmailsSince(storeId: string, sinceIso: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('status', 'falhou')
    .is('resolved_by', null)
    .gte('created_at', sinceIso)
  if (error) throw error
  return count ?? 0
}

export async function listEmailsForCustomer(
  customerId: string,
): Promise<{ createdAt: string; kind: string; status: string; error: string | null }[]> {
  const { data, error } = await createAdminClient()
    .from('email_log')
    .select('created_at, kind, status, error')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data.map((r) => ({ createdAt: r.created_at as string, kind: r.kind as string, status: r.status as string, error: r.error as string | null }))
}

export async function listItemOpensForCustomer(
  customerId: string,
): Promise<{ createdAt: string; itemTitle: string; productTitle: string }[]> {
  const { data, error } = await createAdminClient()
    .from('item_access')
    .select('created_at, items(title), products(title)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  type Row = { created_at: string; items: { title: string } | null; products: { title: string } | null }
  return (data as unknown as Row[]).map((r) => ({
    createdAt: r.created_at,
    itemTitle: r.items?.title ?? 'Item removido',
    productTitle: r.products?.title ?? '',
  }))
}
```

- [ ] **Step 7: Verificar tudo**

Run: `npm test` → Expected: PASS.
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: concluído.

- [ ] **Step 8: Commit**

```bash
git add src/lib/success src/lib/data/success.ts tests/success
git commit -m "feat: classificação de sucesso do cliente e linha do tempo"
```

---

### Task 5: Tema Netflix, utilitários de conteúdo e componentes base

**Executor:** Subagente Claude (frente B).

**Files:**
- Modify: `src/app/globals.css` (arquivo inteiro), `src/app/layout.tsx` (arquivo inteiro)
- Create: `src/lib/content/slug.ts`, `src/lib/content/url.ts`, `src/lib/content/cover.ts`, `src/lib/content/video.ts`, `src/lib/support/whatsapp.ts`
- Create: `src/components/membros/icons.tsx`, `src/components/membros/auto-cover.tsx`, `src/components/membros/carousel.tsx`, `src/components/membros/poster-card.tsx`, `src/components/membros/locked-poster.tsx`, `src/components/membros/hero.tsx`, `src/components/membros/store-header.tsx`, `src/components/membros/whatsapp-button.tsx`, `src/components/membros/skeletons.tsx`, `src/components/admin/ui.ts`
- Create: `tests/content/slug.test.ts`, `tests/content/url.test.ts`, `tests/content/cover.test.ts`, `tests/content/video.test.ts`, `tests/support/whatsapp.test.ts`

**Interfaces:**
- Consumes: `Store`, `ShelfProduct` (Task 1).
- Produces:
  - `@/lib/content/slug`: `RESERVED_STORE_SLUGS: ReadonlySet<string>`, `slugify(text)`, `isValidSlug(slug)`, `isReservedStoreSlug(slug)`, `isValidStoreSlug(slug)`.
  - `@/lib/content/url`: `isHttpUrl(value)`, `isUuid(value)`.
  - `@/lib/content/cover`: `coverGradient(seed): string`.
  - `@/lib/content/video`: `type VideoEmbed = { provider: 'youtube' | 'vimeo' | 'panda'; embedUrl: string }`, `toVideoEmbed(url): VideoEmbed | null`.
  - `@/lib/support/whatsapp`: `type SupportContext = 'nao_encontrado' | 'geral'`, `normalizeWhatsapp(value)`, `supportMessage(context, storeName, email?)`, `supportHref(store, context, email?)`.
  - Componentes: `LockIcon`, `PlayIcon`, `FileIcon`, `LinkIcon`, `WhatsAppIcon`, `DownloadIcon`; `AutoCover`; `Carousel`; `POSTER_WIDTH`, `PosterLink`; `LockedPoster`; `Hero`; `StoreHeader`; `WhatsAppFloating`; `ShelfSkeleton`; `ui` (classes do admin).
  - Tokens Tailwind: `fundo`, `superficie`, `superficie-2`, `borda`, `texto`, `texto-suave`, `destaque`, `destaque-hover`, `sucesso`, `alerta`, `whatsapp`.

- [ ] **Step 1: Escrever os testes dos utilitários**

Criar `tests/content/slug.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isReservedStoreSlug, isValidSlug, isValidStoreSlug, slugify } from '@/lib/content/slug'

describe('slug', () => {
  it('gera slug sem acentos e sem símbolos', () => {
    expect(slugify('Atlas Visual — Patologias da Construção!')).toBe('atlas-visual-patologias-da-construcao')
    expect(slugify('  --Olá  Mundo--  ')).toBe('ola-mundo')
  })

  it('limita o tamanho sem terminar em hífen', () => {
    const slug = slugify(`${'a'.repeat(59)} b`)
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('valida o formato', () => {
    expect(isValidSlug('arquitetura')).toBe(true)
    expect(isValidSlug('nutricao-animal-2')).toBe(true)
    expect(isValidSlug('Arquitetura')).toBe(false)
    expect(isValidSlug('a--b')).toBe(false)
    expect(isValidSlug('')).toBe(false)
  })

  it('recusa slugs reservados para loja', () => {
    for (const slug of ['admin', 'api', 'entrar', 'sair', 'icons']) {
      expect(isReservedStoreSlug(slug)).toBe(true)
      expect(isValidStoreSlug(slug)).toBe(false)
    }
    expect(isValidStoreSlug('estoicismo')).toBe(true)
  })
})
```

Criar `tests/content/url.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isHttpUrl, isUuid } from '@/lib/content/url'

describe('url', () => {
  it('aceita só http e https', () => {
    expect(isHttpUrl('https://drive.google.com/file/d/1')).toBe(true)
    expect(isHttpUrl('http://exemplo.com')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('ftp://x.com')).toBe(false)
    expect(isHttpUrl('sem url')).toBe(false)
  })

  it('reconhece uuid', () => {
    expect(isUuid('0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c')).toBe(true)
    expect(isUuid('123')).toBe(false)
  })
})
```

Criar `tests/content/cover.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { coverGradient } from '@/lib/content/cover'

describe('coverGradient', () => {
  it('é determinístico para o mesmo id', () => {
    expect(coverGradient('produto-1')).toBe(coverGradient('produto-1'))
  })

  it('gera um gradiente CSS', () => {
    expect(coverGradient('qualquer')).toMatch(/^linear-gradient\(160deg, #[0-9a-f]{6} 0%, #0b0b0c 85%\)$/)
  })

  it('varia entre ids diferentes', () => {
    const values = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(coverGradient))
    expect(values.size).toBeGreaterThan(1)
  })
})
```

Criar `tests/content/video.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toVideoEmbed } from '@/lib/content/video'

describe('toVideoEmbed', () => {
  it('YouTube em vários formatos', () => {
    const expected = { provider: 'youtube', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }
    expect(toVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toEqual(expected)
    expect(toVideoEmbed('https://youtu.be/dQw4w9WgXcQ')).toEqual(expected)
    expect(toVideoEmbed('https://youtube.com/shorts/dQw4w9WgXcQ')).toEqual(expected)
    expect(toVideoEmbed('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual(expected)
    expect(toVideoEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual(expected)
  })

  it('Vimeo público e privado', () => {
    expect(toVideoEmbed('https://vimeo.com/123456789')).toEqual({ provider: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456789' })
    expect(toVideoEmbed('https://vimeo.com/123456789/abcdef1234')).toEqual({
      provider: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456789?h=abcdef1234',
    })
    expect(toVideoEmbed('https://player.vimeo.com/video/123456789?h=abc123')).toEqual({
      provider: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456789?h=abc123',
    })
  })

  it('Panda', () => {
    const url = 'https://player-vz-7b6cf9e4-8bf.tv.pandavideo.com.br/embed/?v=0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c'
    expect(toVideoEmbed(url)).toEqual({ provider: 'panda', embedUrl: url })
  })

  it('recusa endereços que não são vídeo suportado', () => {
    expect(toVideoEmbed('https://drive.google.com/file/d/abc')).toBeNull()
    expect(toVideoEmbed('https://www.youtube.com/watch?v=curto')).toBeNull()
    expect(toVideoEmbed('javascript:alert(1)')).toBeNull()
    expect(toVideoEmbed('não é url')).toBeNull()
  })
})
```

Criar `tests/support/whatsapp.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeWhatsapp, supportHref, supportMessage } from '@/lib/support/whatsapp'

const store = { name: 'Arquitetura', supportWhatsapp: '+55 (11) 99999-8888', supportUrl: 'https://ajuda.exemplo.com' }

describe('whatsapp', () => {
  it('normaliza o número', () => {
    expect(normalizeWhatsapp('+55 (11) 99999-8888')).toBe('5511999998888')
    expect(normalizeWhatsapp('1234')).toBeNull()
  })

  it('monta a mensagem de e-mail não encontrado', () => {
    expect(supportMessage('nao_encontrado', 'Arquitetura', 'joao@gmail.com')).toBe(
      'Olá! Comprei um produto da Arquitetura com o e-mail joao@gmail.com e não estou conseguindo acessar.',
    )
    expect(supportMessage('nao_encontrado', 'Arquitetura')).toBe('Olá! Comprei um produto da Arquitetura e não estou conseguindo acessar.')
  })

  it('monta a mensagem geral', () => {
    expect(supportMessage('geral', 'Arquitetura', 'joao@gmail.com')).toBe(
      'Olá! Preciso de ajuda com a área de membros da Arquitetura. Meu e-mail é joao@gmail.com.',
    )
  })

  it('usa WhatsApp quando há número, senão o link de suporte, senão nada', () => {
    expect(supportHref(store, 'nao_encontrado', 'joao@gmail.com')).toBe(
      `https://wa.me/5511999998888?text=${encodeURIComponent('Olá! Comprei um produto da Arquitetura com o e-mail joao@gmail.com e não estou conseguindo acessar.')}`,
    )
    expect(supportHref({ ...store, supportWhatsapp: null }, 'geral')).toBe('https://ajuda.exemplo.com')
    expect(supportHref({ ...store, supportWhatsapp: null, supportUrl: null }, 'geral')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/content tests/support`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar os utilitários**

Criar `src/lib/content/slug.ts`:

```ts
export const RESERVED_STORE_SLUGS: ReadonlySet<string> = new Set([
  'admin', 'api', 'entrar', 'sair', '_next', 'favicon.ico', 'manifest.webmanifest', 'sw.js', 'icons',
])

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug)
}

export function isReservedStoreSlug(slug: string): boolean {
  return RESERVED_STORE_SLUGS.has(slug)
}

export function isValidStoreSlug(slug: string): boolean {
  return isValidSlug(slug) && !isReservedStoreSlug(slug)
}
```

Criar `src/lib/content/url.ts`:

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
```

Criar `src/lib/content/cover.ts`:

```ts
const TONES = ['#3f0d12', '#1e1b4b', '#052e2b', '#3b0764', '#422006', '#172554', '#4a044e', '#27272a']

export function coverGradient(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return `linear-gradient(160deg, ${TONES[hash % TONES.length]} 0%, #0b0b0c 85%)`
}
```

Criar `src/lib/content/video.ts`:

```ts
export type VideoEmbed = { provider: 'youtube' | 'vimeo' | 'panda'; embedUrl: string }

function youtubeId(url: URL, host: string): string | null {
  const valid = (id: string | null | undefined) => (id && /^[\w-]{11}$/.test(id) ? id : null)
  if (host === 'youtu.be') return valid(url.pathname.slice(1).split('/')[0])
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') return valid(url.searchParams.get('v'))
    const [kind, id] = url.pathname.split('/').filter(Boolean)
    if (kind === 'embed' || kind === 'shorts' || kind === 'live') return valid(id)
  }
  return null
}

export function toVideoEmbed(raw: string): VideoEmbed | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.replace(/^(www|m)\./, '')

  const ytId = youtubeId(url, host)
  if (ytId) return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}` }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const index = parts.findIndex((p) => /^\d+$/.test(p))
    if (index === -1) return null
    const next = parts[index + 1]
    const hash = url.searchParams.get('h') ?? (next && /^[a-f0-9]+$/i.test(next) ? next : null)
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${parts[index]}${hash ? `?h=${hash}` : ''}` }
  }

  if (host.endsWith('pandavideo.com.br')) {
    const v = url.searchParams.get('v')
    if (!v || !/^[0-9a-f-]{36}$/i.test(v)) return null
    return { provider: 'panda', embedUrl: `https://${url.hostname}/embed/?v=${v}` }
  }

  return null
}
```

Criar `src/lib/support/whatsapp.ts`:

```ts
import type { Store } from '@/lib/domain/types'

export type SupportContext = 'nao_encontrado' | 'geral'

export function normalizeWhatsapp(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15 ? digits : null
}

export function supportMessage(context: SupportContext, storeName: string, email?: string | null): string {
  if (context === 'nao_encontrado') {
    return email
      ? `Olá! Comprei um produto da ${storeName} com o e-mail ${email} e não estou conseguindo acessar.`
      : `Olá! Comprei um produto da ${storeName} e não estou conseguindo acessar.`
  }
  return email
    ? `Olá! Preciso de ajuda com a área de membros da ${storeName}. Meu e-mail é ${email}.`
    : `Olá! Preciso de ajuda com a área de membros da ${storeName}.`
}

export function supportHref(
  store: Pick<Store, 'name' | 'supportWhatsapp' | 'supportUrl'>,
  context: SupportContext,
  email?: string | null,
): string | null {
  const phone = store.supportWhatsapp ? normalizeWhatsapp(store.supportWhatsapp) : null
  if (phone) return `https://wa.me/${phone}?text=${encodeURIComponent(supportMessage(context, store.name, email))}`
  return store.supportUrl ?? null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/content tests/support`
Expected: PASS.

- [ ] **Step 5: Tema e layout raiz**

Substituir `src/app/globals.css`:

```css
@import "tailwindcss";

@theme inline {
  --color-fundo: #0b0b0c;
  --color-superficie: #141414;
  --color-superficie-2: #1c1c1f;
  --color-borda: #2a2a2e;
  --color-texto: #f5f5f5;
  --color-texto-suave: #a1a1aa;
  --color-destaque: #e11d2e;
  --color-destaque-hover: #f43f5e;
  --color-sucesso: #22c55e;
  --color-alerta: #f59e0b;
  --color-whatsapp: #25d366;
  --font-sans: var(--font-inter), system-ui, sans-serif;
}

:root {
  color-scheme: dark;
}

body {
  background-color: var(--color-fundo);
  color: var(--color-texto);
  font-family: var(--font-sans);
}

:focus-visible {
  outline: 2px solid var(--color-destaque);
  outline-offset: 2px;
}

.sem-barra {
  scrollbar-width: none;
}

.sem-barra::-webkit-scrollbar {
  display: none;
}

@media (prefers-reduced-motion: no-preference) {
  .painel-sobe {
    animation: painel-sobe 180ms ease-out;
  }
}

@keyframes painel-sobe {
  from {
    transform: translateY(16px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

Substituir `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Área de Membros',
  description: 'Seus produtos em um só lugar',
}

export const viewport: Viewport = {
  themeColor: '#0b0b0c',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-fundo text-texto">{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: Criar os componentes base**

Criar `src/components/membros/icons.tsx`:

```tsx
type IconProps = { className?: string }

const base = 'h-4 w-4 shrink-0'

export function LockIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function PlayIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export function FileIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </svg>
  )
}

export function LinkIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1" />
    </svg>
  )
}

export function DownloadIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M12 3v12m0 0-4-4m4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

export function WhatsAppIcon({ className = 'h-7 w-7' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 3.9 3.5 2.3 1 2.3.7 2.8.6.4 0 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1l-.5-.3z" />
    </svg>
  )
}
```

Criar `src/components/membros/auto-cover.tsx`:

```tsx
import { coverGradient } from '@/lib/content/cover'

const ASPECT = { poster: 'aspect-[2/3]', banner: 'aspect-video', episode: 'aspect-video' } as const

export function AutoCover({
  seed,
  title,
  imageUrl,
  aspect,
  muted = false,
  className = '',
}: {
  seed: string
  title: string
  imageUrl: string | null
  aspect: keyof typeof ASPECT
  muted?: boolean
  className?: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-superficie-2 ${ASPECT[aspect]} ${className}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" loading="lazy" className={`h-full w-full object-cover ${muted ? 'opacity-40 grayscale' : ''}`} />
      ) : (
        <div className={`flex h-full w-full items-end p-3 ${muted ? 'opacity-50' : ''}`} style={{ backgroundImage: coverGradient(seed) }}>
          {title && <span className="line-clamp-3 text-sm leading-tight font-bold text-texto sm:text-base">{title}</span>}
        </div>
      )}
    </div>
  )
}
```

Criar `src/components/membros/carousel.tsx`:

```tsx
'use client'

import { useRef } from 'react'

export function Carousel({ title, children }: { title: string; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const scroll = (direction: 1 | -1) => {
    const el = track.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <section className="group/row relative" aria-label={title}>
      <h2 className="mb-3 px-4 text-lg font-semibold sm:px-8 sm:text-xl">{title}</h2>
      <div ref={track} className="sem-barra flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-4 sm:scroll-px-8 sm:gap-4 sm:px-8">
        {children}
      </div>
      <button
        type="button"
        aria-label={`Voltar em ${title}`}
        onClick={() => scroll(-1)}
        className="absolute top-10 bottom-4 left-0 hidden w-10 items-center justify-center bg-gradient-to-r from-fundo to-transparent text-3xl text-texto opacity-0 transition group-hover/row:opacity-100 focus-visible:opacity-100 sm:flex"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label={`Avançar em ${title}`}
        onClick={() => scroll(1)}
        className="absolute top-10 right-0 bottom-4 hidden w-10 items-center justify-center bg-gradient-to-l from-fundo to-transparent text-3xl text-texto opacity-0 transition group-hover/row:opacity-100 focus-visible:opacity-100 sm:flex"
      >
        ›
      </button>
    </section>
  )
}
```

Criar `src/components/membros/poster-card.tsx`:

```tsx
import Link from 'next/link'
import type { ShelfProduct } from '@/lib/access/access'
import { AutoCover } from './auto-cover'

export const POSTER_WIDTH = 'w-[40%] shrink-0 snap-start sm:w-[26%] md:w-[20%] lg:w-[15%]'

export function PosterLink({ product, href }: { product: ShelfProduct; href: string }) {
  return (
    <Link href={href} className={`${POSTER_WIDTH} group block transition-transform duration-200 hover:scale-[1.04]`}>
      <AutoCover seed={product.id} title={product.title} imageUrl={product.coverUrl} aspect="poster" />
      <p className="mt-2 line-clamp-2 text-sm text-texto-suave group-hover:text-texto">{product.title}</p>
    </Link>
  )
}
```

Criar `src/components/membros/locked-poster.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { ShelfProduct } from '@/lib/access/access'
import { AutoCover } from './auto-cover'
import { LockIcon } from './icons'
import { POSTER_WIDTH } from './poster-card'

export function LockedPoster({ product, initiallyOpen = false }: { product: ShelfProduct; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${product.title} — bloqueado, ver detalhes`}
        className={`${POSTER_WIDTH} group block text-left transition-transform duration-200 hover:scale-[1.04]`}
      >
        <div className="relative">
          <AutoCover seed={product.id} title={product.title} imageUrl={product.coverUrl} aspect="poster" muted />
          <span className="absolute top-2 right-2 rounded-full bg-fundo/85 p-1.5 text-texto">
            <LockIcon />
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-texto-suave">{product.title}</p>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`comprar-${product.id}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div className="painel-sobe w-full max-w-lg overflow-hidden rounded-t-xl bg-superficie sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <AutoCover seed={product.id} title="" imageUrl={product.bannerUrl ?? product.coverUrl} aspect="banner" className="rounded-none" />
            <div className="p-6">
              <h2 id={`comprar-${product.id}`} className="text-2xl leading-tight font-bold">{product.title}</h2>
              {product.description && <p className="mt-3 leading-relaxed whitespace-pre-line text-texto-suave">{product.description}</p>}
              <div className="mt-6 flex flex-col gap-2">
                {product.checkoutUrl && (
                  <a
                    href={product.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-destaque px-4 py-3 text-center font-semibold text-white hover:bg-destaque-hover"
                  >
                    Quero acessar
                  </a>
                )}
                <button ref={closeButton} type="button" onClick={() => setOpen(false)} className="rounded-md px-4 py-3 text-texto-suave hover:text-texto">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

Criar `src/components/membros/hero.tsx`:

```tsx
import Link from 'next/link'
import type { ShelfProduct } from '@/lib/access/access'
import { AutoCover } from './auto-cover'
import { LockIcon, PlayIcon } from './icons'

export function Hero({ product, storeSlug }: { product: ShelfProduct; storeSlug: string }) {
  const href = product.unlocked ? `/${storeSlug}/produto/${product.slug}` : `/${storeSlug}?comprar=${product.slug}`
  return (
    <section className="relative">
      <AutoCover seed={product.id} title="" imageUrl={product.bannerUrl ?? product.coverUrl} aspect="banner" className="max-h-[72vh] w-full rounded-none sm:aspect-[21/9]" />
      <div className="absolute inset-0 bg-gradient-to-t from-fundo via-fundo/40 to-transparent" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-fundo/80 via-transparent to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-8 sm:px-8 sm:pb-14">
        <h1 className="max-w-2xl text-3xl leading-tight font-extrabold sm:text-5xl">{product.title}</h1>
        {product.description && <p className="mt-3 line-clamp-3 max-w-xl text-sm text-texto-suave sm:text-base">{product.description}</p>}
        <Link href={href} className="mt-5 inline-flex items-center gap-2 rounded-md bg-destaque px-6 py-3 font-semibold text-white hover:bg-destaque-hover">
          {product.unlocked ? <PlayIcon /> : <LockIcon />}
          {product.unlocked ? 'Acessar' : 'Quero acessar'}
        </Link>
      </div>
    </section>
  )
}
```

Criar `src/components/membros/store-header.tsx`:

```tsx
import Link from 'next/link'
import type { Store } from '@/lib/domain/types'

export function StoreHeader({
  store,
  email,
  actions,
}: {
  store: Pick<Store, 'slug' | 'name' | 'logoUrl'>
  email: string
  actions?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-40 bg-gradient-to-b from-fundo to-fundo/85 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link href={`/${store.slug}`} className="flex min-w-0 items-center gap-3">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt="" className="h-8 w-auto" />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-destaque font-bold text-white">
              {store.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate font-semibold">{store.name}</span>
        </Link>
        <div className="flex items-center gap-3">
          {actions}
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full bg-superficie-2 px-3 py-1.5 text-sm text-texto-suave hover:text-texto">
              Conta
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-md border border-borda bg-superficie p-3 text-sm shadow-xl">
              <p className="truncate text-texto-suave">{email}</p>
              <form action={`/sair?loja=${store.slug}`} method="post" className="mt-3">
                <button type="submit" className="w-full rounded-md bg-superficie-2 px-3 py-2 text-left hover:bg-borda">
                  Sair
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}
```

Criar `src/components/membros/whatsapp-button.tsx`:

```tsx
import { WhatsAppIcon } from './icons'

export function WhatsAppFloating({ href }: { href: string | null }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com o suporte"
      className="fixed right-5 bottom-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-whatsapp text-white shadow-lg hover:brightness-110"
    >
      <WhatsAppIcon />
    </a>
  )
}
```

Criar `src/components/membros/skeletons.tsx`:

```tsx
export function ShelfSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="aspect-video max-h-[72vh] w-full bg-superficie sm:aspect-[21/9]" />
      {[0, 1].map((row) => (
        <div key={row} className="mt-8 px-4 sm:px-8">
          <div className="mb-3 h-5 w-40 rounded bg-superficie-2" />
          <div className="flex gap-3 overflow-hidden sm:gap-4">
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <div key={card} className="aspect-[2/3] w-[40%] shrink-0 rounded-md bg-superficie sm:w-[26%] md:w-[20%] lg:w-[15%]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

Criar `src/components/admin/ui.ts`:

```ts
export const ui = {
  h1: 'text-xl font-bold',
  card: 'rounded-lg border border-borda bg-superficie',
  label: 'flex flex-col gap-1 text-sm font-medium text-texto-suave',
  input:
    'rounded-md border border-borda bg-fundo px-3 py-2 text-base font-normal text-texto placeholder:text-texto-suave focus:border-destaque focus:outline-none',
  checkbox: 'flex items-center gap-2 text-sm font-medium text-texto',
  button: 'rounded-md bg-destaque px-4 py-2 text-sm font-semibold text-white hover:bg-destaque-hover disabled:opacity-60',
  buttonGhost: 'rounded-md border border-borda px-3 py-2 text-sm text-texto hover:bg-superficie-2',
  buttonDanger: 'rounded-md border border-destaque/50 px-3 py-2 text-sm text-destaque hover:bg-destaque/10',
  table: 'w-full min-w-[640px] text-left text-sm',
  th: 'px-4 py-2 font-medium text-texto-suave',
  td: 'px-4 py-2 align-top',
  pill: 'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
  notice: 'rounded-md border border-borda bg-superficie-2 px-3 py-2 text-sm',
  chip: (active: boolean) =>
    `rounded-full px-3 py-1 text-sm ${active ? 'bg-destaque text-white' : 'bg-superficie-2 text-texto-suave hover:text-texto'}`,
} as const
```

- [ ] **Step 7: Verificar tudo**

Run: `npm test` → Expected: PASS.
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: concluído (a vitrine antiga fica sem cores até a Task 6; não é erro).

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/lib/content src/lib/support src/components tests/content tests/support
git commit -m "feat: tema escuro Netflix, utilitários de conteúdo e componentes base"
```

---

### Task 6: Rotas por loja — vitrine, produto e item

**Executor:** Subagente Claude (frente B).

**Files:**
- Create: `src/lib/membros/paths.ts`, `src/lib/membros/session.ts`, `src/lib/data/item-access.ts`
- Create: `src/components/membros/episode-card.tsx`
- Create: `src/app/[loja]/layout.tsx`, `src/app/[loja]/page.tsx`, `src/app/[loja]/loading.tsx`
- Create: `src/app/[loja]/produto/[slug]/page.tsx`, `src/app/[loja]/item/[id]/page.tsx`
- Create: `src/app/[loja]/entrar/page.tsx`, `src/app/[loja]/entrar/form.tsx`, `src/app/[loja]/entrar/actions.ts`
- Create: `tests/membros/paths.test.ts`
- Modify: `src/app/page.tsx`, `src/app/entrar/page.tsx`, `src/app/sair/route.ts`, `src/lib/supabase/proxy.ts` (arquivos inteiros)
- Delete: `src/app/entrar/form.tsx`, `src/app/entrar/actions.ts`, `src/app/vitrine/cover.tsx`, `src/app/vitrine/locked-card.tsx`

**Interfaces:**
- Consumes: Task 1 (`loadStoreAccess`, `buildShelf`, `listModulesWithItems`, `getProductBySlug`, `getItemWithContext`, `getStoreBySlug`); Task 5 (componentes, `supportHref`, `toVideoEmbed`, `isUuid`, `RESERVED_STORE_SLUGS`, `isValidStoreSlug`).
- Produces:
  - `@/lib/membros/paths`: `protectedStoreSlug(pathname): string | null`.
  - `@/lib/membros/session`: `getStore(slug): Promise<Store>` (com `cache`), `requireStoreSession(slug): Promise<{ store: Store; customer: CustomerRow }>`.
  - `@/lib/data/item-access`: `recordItemAccess(entry)`, `listRecentProductIds(customerId, storeId, days?)`.
  - `EpisodeCard`, `EPISODE_WIDTH`, `ItemAnchor`.
  - Login mínimo em `/[loja]/entrar` com a lógica atual (a Task 7 substitui).

- [ ] **Step 1: Teste do caminho protegido**

Criar `tests/membros/paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { protectedStoreSlug } from '@/lib/membros/paths'

describe('protectedStoreSlug', () => {
  it('protege vitrine, produto e item da loja', () => {
    expect(protectedStoreSlug('/arquitetura')).toBe('arquitetura')
    expect(protectedStoreSlug('/arquitetura/produto/atlas')).toBe('arquitetura')
    expect(protectedStoreSlug('/arquitetura/item/0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c')).toBe('arquitetura')
  })

  it('não protege login, manifesto, raiz nem rotas reservadas', () => {
    expect(protectedStoreSlug('/arquitetura/entrar')).toBeNull()
    expect(protectedStoreSlug('/arquitetura/manifest.webmanifest')).toBeNull()
    expect(protectedStoreSlug('/')).toBeNull()
    expect(protectedStoreSlug('/admin/pedidos')).toBeNull()
    expect(protectedStoreSlug('/entrar')).toBeNull()
    expect(protectedStoreSlug('/icons/arquitetura/192')).toBeNull()
  })
})
```

Run: `npx vitest run tests/membros/paths.test.ts` → Expected: FAIL (módulo inexistente).

- [ ] **Step 2: Implementar `src/lib/membros/paths.ts`**

```ts
import { RESERVED_STORE_SLUGS } from '@/lib/content/slug'

export function protectedStoreSlug(pathname: string): string | null {
  const [first, second] = pathname.split('/').filter(Boolean)
  if (!first || RESERVED_STORE_SLUGS.has(first)) return null
  if (second === 'entrar' || second === 'manifest.webmanifest') return null
  return first
}
```

Run: `npx vitest run tests/membros/paths.test.ts` → Expected: PASS.

- [ ] **Step 3: Sessão da loja e registro de itens**

Criar `src/lib/membros/session.ts`:

```ts
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { isValidStoreSlug } from '@/lib/content/slug'
import { findCustomerByEmail } from '@/lib/data/customers'
import { getStoreBySlug } from '@/lib/data/stores'
import type { CustomerRow, Store } from '@/lib/domain/types'
import { createClient } from '@/lib/supabase/server'

export const getStore = cache(async (slug: string): Promise<Store> => {
  if (!isValidStoreSlug(slug)) notFound()
  const store = await getStoreBySlug(slug)
  if (!store) notFound()
  return store
})

export async function requireStoreSession(slug: string): Promise<{ store: Store; customer: CustomerRow }> {
  const store = await getStore(slug)
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email
  if (!email) redirect(`/${store.slug}/entrar`)

  const customer = await findCustomerByEmail(email)
  if (!customer || customer.blockedAt) {
    await supabase.auth.signOut()
    redirect(`/${store.slug}/entrar`)
  }
  return { store, customer }
}
```

Criar `src/lib/data/item-access.ts`:

```ts
import type { ItemKind } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

export async function recordItemAccess(entry: {
  customerId: string
  storeId: string
  productId: string
  itemId: string
  kind: ItemKind
}): Promise<void> {
  const { error } = await createAdminClient().from('item_access').insert({
    customer_id: entry.customerId,
    store_id: entry.storeId,
    product_id: entry.productId,
    item_id: entry.itemId,
    kind: entry.kind,
  })
  if (error) throw error
}

export async function listRecentProductIds(customerId: string, storeId: string, days = 30): Promise<string[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await createAdminClient()
    .from('item_access')
    .select('product_id')
    .eq('customer_id', customerId)
    .eq('store_id', storeId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return [...new Set(data.map((row) => row.product_id as string))]
}
```

- [ ] **Step 4: Card de item (episódio)**

Criar `src/components/membros/episode-card.tsx`:

```tsx
import Link from 'next/link'
import type { Item } from '@/lib/domain/types'
import { AutoCover } from './auto-cover'
import { FileIcon, LinkIcon, PlayIcon } from './icons'

export const EPISODE_WIDTH = 'w-[75%] shrink-0 snap-start sm:w-[40%] lg:w-[24%]'

const LABEL = { arquivo: 'Arquivo', video: 'Vídeo', link: 'Link' } as const
const ICON = { arquivo: FileIcon, video: PlayIcon, link: LinkIcon } as const

export function ItemAnchor({
  item,
  storeSlug,
  className,
  children,
  current = false,
}: {
  item: Pick<Item, 'id' | 'kind'>
  storeSlug: string
  className: string
  children: React.ReactNode
  current?: boolean
}) {
  const href = `/${storeSlug}/item/${item.id}`
  if (item.kind === 'video') {
    return (
      <Link href={href} prefetch={false} className={className} aria-current={current ? 'page' : undefined}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}

export function EpisodeCard({ item, storeSlug, className = '' }: { item: Item; storeSlug: string; className?: string }) {
  const Icon = ICON[item.kind]
  return (
    <ItemAnchor item={item} storeSlug={storeSlug} className={`group block transition-transform duration-200 hover:scale-[1.03] ${className}`}>
      <div className="relative">
        <AutoCover seed={item.id} title={item.title} imageUrl={item.coverUrl} aspect="episode" />
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-fundo/85 px-2 py-1 text-xs text-texto">
          <Icon className="h-3.5 w-3.5" />
          {LABEL[item.kind]}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-texto-suave group-hover:text-texto">{item.title}</p>
    </ItemAnchor>
  )
}
```

- [ ] **Step 5: Layout, vitrine e carregamento da loja**

Criar `src/app/[loja]/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { getStore } from '@/lib/membros/session'

export async function generateMetadata({ params }: { params: Promise<{ loja: string }> }): Promise<Metadata> {
  const { loja } = await params
  const store = await getStore(loja)
  return { title: store.name, robots: { index: false, follow: false } }
}

export default async function LojaLayout({ children, params }: LayoutProps<'/[loja]'>) {
  const { loja } = await params
  await getStore(loja)
  return <div className="min-h-dvh bg-fundo text-texto">{children}</div>
}
```

Criar `src/app/[loja]/loading.tsx`:

```tsx
import { ShelfSkeleton } from '@/components/membros/skeletons'

export default function Loading() {
  return <ShelfSkeleton />
}
```

Criar `src/app/[loja]/page.tsx`:

```tsx
import { Carousel } from '@/components/membros/carousel'
import { Hero } from '@/components/membros/hero'
import { LockedPoster } from '@/components/membros/locked-poster'
import { PosterLink } from '@/components/membros/poster-card'
import { StoreHeader } from '@/components/membros/store-header'
import { WhatsAppFloating } from '@/components/membros/whatsapp-button'
import { buildShelf } from '@/lib/access/access'
import { loadStoreAccess } from '@/lib/data/access'
import { listRecentProductIds } from '@/lib/data/item-access'
import { requireStoreSession } from '@/lib/membros/session'
import { supportHref } from '@/lib/support/whatsapp'

export const dynamic = 'force-dynamic'

export default async function VitrinePage({ params, searchParams }: PageProps<'/[loja]'>) {
  const [{ loja }, { comprar }] = await Promise.all([params, searchParams])
  const { store, customer } = await requireStoreSession(loja)
  const [{ products, granted }, recentIds] = await Promise.all([
    loadStoreAccess(store.id, customer.email),
    listRecentProductIds(customer.id, store.id),
  ])
  const shelf = buildShelf(products, granted)
  const continuing = recentIds.flatMap((id) => shelf.unlocked.filter((p) => p.id === id))
  const openSlug = typeof comprar === 'string' ? comprar : null
  const support = supportHref(store, 'geral', customer.email)

  return (
    <>
      <StoreHeader store={store} email={customer.email} />
      <main className="pb-24">
        {shelf.featured && <Hero product={shelf.featured} storeSlug={store.slug} />}
        <div className={`relative flex flex-col gap-8 ${shelf.featured ? '-mt-2 sm:-mt-8' : 'pt-6'}`}>
          {continuing.length > 0 && (
            <Carousel title="Continuar">
              {continuing.map((p) => (
                <PosterLink key={p.id} product={p} href={`/${store.slug}/produto/${p.slug}`} />
              ))}
            </Carousel>
          )}

          {shelf.unlocked.length > 0 ? (
            <Carousel title="Seus produtos">
              {shelf.unlocked.map((p) => (
                <PosterLink key={p.id} product={p} href={`/${store.slug}/produto/${p.slug}`} />
              ))}
            </Carousel>
          ) : (
            <section className="mx-4 rounded-lg border border-borda bg-superficie p-6 sm:mx-8">
              <h2 className="text-lg font-semibold">Nenhum produto liberado ainda</h2>
              <p className="mt-2 max-w-prose text-texto-suave">
                Seus produtos aparecem aqui assim que o pagamento é confirmado. Se você já pagou e nada apareceu, fale com a gente.
              </p>
              {support && (
                <a href={support} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-md bg-whatsapp px-4 py-2 font-semibold text-white hover:brightness-110">
                  Falar com o suporte
                </a>
              )}
            </section>
          )}

          {shelf.locked.length > 0 && (
            <Carousel title="Desbloqueie mais">
              {shelf.locked.map((p) => (
                <LockedPoster key={p.id} product={p} initiallyOpen={openSlug === p.slug} />
              ))}
            </Carousel>
          )}
        </div>
      </main>
      <WhatsAppFloating href={support} />
    </>
  )
}
```

- [ ] **Step 6: Página do produto**

Criar `src/app/[loja]/produto/[slug]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AutoCover } from '@/components/membros/auto-cover'
import { Carousel } from '@/components/membros/carousel'
import { EPISODE_WIDTH, EpisodeCard } from '@/components/membros/episode-card'
import { StoreHeader } from '@/components/membros/store-header'
import { WhatsAppFloating } from '@/components/membros/whatsapp-button'
import { loadStoreAccess } from '@/lib/data/access'
import { getProductBySlug, listModulesWithItems } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'
import { supportHref } from '@/lib/support/whatsapp'

export const dynamic = 'force-dynamic'

export default async function ProdutoPage({ params }: PageProps<'/[loja]/produto/[slug]'>) {
  const { loja, slug } = await params
  const { store, customer } = await requireStoreSession(loja)
  const product = await getProductBySlug(store.id, slug)
  if (!product || !product.isPublished) notFound()

  const { granted } = await loadStoreAccess(store.id, customer.email)
  if (!granted.has(product.id)) redirect(`/${store.slug}?comprar=${product.slug}`)

  const modules = (await listModulesWithItems(product.id, { publishedOnly: true })).filter((m) => m.items.length > 0)
  const support = supportHref(store, 'geral', customer.email)

  return (
    <>
      <StoreHeader store={store} email={customer.email} />
      <main className="pb-24">
        <section className="relative">
          <AutoCover seed={product.id} title="" imageUrl={product.bannerUrl ?? product.coverUrl} aspect="banner" className="max-h-[55vh] w-full rounded-none sm:aspect-[21/9]" />
          <div className="absolute inset-0 bg-gradient-to-t from-fundo via-fundo/50 to-transparent" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-6 sm:px-8 sm:pb-10">
            <Link href={`/${store.slug}`} className="text-sm text-texto-suave hover:text-texto">
              ← Voltar
            </Link>
            <h1 className="mt-2 max-w-3xl text-3xl leading-tight font-extrabold sm:text-5xl">{product.title}</h1>
            {product.description && <p className="mt-3 line-clamp-4 max-w-2xl text-sm text-texto-suave sm:text-base">{product.description}</p>}
          </div>
        </section>

        {modules.length === 0 && <p className="px-4 pt-6 text-texto-suave sm:px-8">Nenhum conteúdo publicado ainda.</p>}

        {modules.length === 1 && (
          <section className="px-4 pt-6 sm:px-8" aria-label="Conteúdo">
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {modules[0].items.map((item) => (
                <li key={item.id}>
                  <EpisodeCard item={item} storeSlug={store.slug} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {modules.length > 1 && (
          <div className="flex flex-col gap-8 pt-6">
            {modules.map((m) => (
              <Carousel key={m.id} title={m.title}>
                {m.items.map((item) => (
                  <EpisodeCard key={item.id} item={item} storeSlug={store.slug} className={EPISODE_WIDTH} />
                ))}
              </Carousel>
            ))}
          </div>
        )}
      </main>
      <WhatsAppFloating href={support} />
    </>
  )
}
```

- [ ] **Step 7: Abrir item (arquivo/link redireciona, vídeo toca)**

Criar `src/app/[loja]/item/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ItemAnchor } from '@/components/membros/episode-card'
import { StoreHeader } from '@/components/membros/store-header'
import { toVideoEmbed } from '@/lib/content/video'
import { isHttpUrl, isUuid } from '@/lib/content/url'
import { loadStoreAccess } from '@/lib/data/access'
import { recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext, listModulesWithItems } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'

export const dynamic = 'force-dynamic'

const navButton = 'rounded-md border border-borda px-4 py-2 text-sm hover:bg-superficie-2'

export default async function ItemPage({ params }: PageProps<'/[loja]/item/[id]'>) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()
  const { store, customer } = await requireStoreSession(loja)

  const ctx = await getItemWithContext(id)
  if (!ctx || ctx.product.storeId !== store.id || !ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished) {
    notFound()
  }

  const { granted } = await loadStoreAccess(store.id, customer.email)
  if (!granted.has(ctx.product.id)) redirect(`/${store.slug}?comprar=${ctx.product.slug}`)

  await recordItemAccess({ customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind })

  const embed = ctx.item.kind === 'video' ? toVideoEmbed(ctx.item.url) : null
  if (!embed) {
    if (!isHttpUrl(ctx.item.url)) notFound()
    redirect(ctx.item.url)
  }

  const modules = await listModulesWithItems(ctx.product.id, { publishedOnly: true })
  const siblings = modules.find((m) => m.id === ctx.module.id)?.items ?? []
  const index = siblings.findIndex((s) => s.id === ctx.item.id)
  const previous = index > 0 ? siblings[index - 1] : null
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null

  return (
    <>
      <StoreHeader store={store} email={customer.email} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-4 pb-24 sm:px-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={embed.embedUrl}
              title={ctx.item.title}
              className="h-full w-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <h1 className="mt-4 text-2xl font-bold">{ctx.item.title}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            <Link href={`/${store.slug}/produto/${ctx.product.slug}`} className="hover:text-texto">
              {ctx.product.title}
            </Link>
            {' · '}
            {ctx.module.title}
          </p>
          <nav className="mt-4 flex flex-wrap gap-3" aria-label="Navegação entre itens">
            {previous && (
              <ItemAnchor item={previous} storeSlug={store.slug} className={navButton}>
                ← Anterior
              </ItemAnchor>
            )}
            {next && (
              <ItemAnchor item={next} storeSlug={store.slug} className={navButton}>
                Próximo →
              </ItemAnchor>
            )}
          </nav>
        </div>
        <aside className="lg:w-80">
          <h2 className="mb-3 font-semibold">{ctx.module.title}</h2>
          <ol className="flex flex-col gap-1">
            {siblings.map((s) => (
              <li key={s.id}>
                <ItemAnchor
                  item={s}
                  storeSlug={store.slug}
                  current={s.id === ctx.item.id}
                  className={`block rounded-md px-3 py-2 text-sm ${s.id === ctx.item.id ? 'bg-superficie-2 text-texto' : 'text-texto-suave hover:bg-superficie hover:text-texto'}`}
                >
                  {s.title}
                </ItemAnchor>
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </>
  )
}
```

- [ ] **Step 8: Login mínimo por loja (a Task 7 redesenha)**

```bash
mkdir -p "src/app/[loja]/entrar"
git mv src/app/entrar/actions.ts "src/app/[loja]/entrar/actions.ts"
git mv src/app/entrar/form.tsx "src/app/[loja]/entrar/form.tsx"
```

Substituir `src/app/[loja]/entrar/actions.ts`:

```ts
'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { decideCustomerLogin, type LoginFailure } from '@/lib/auth/customer-login'
import { countRecentLoginAttempts, findCustomerByEmail, recordDevice, recordLoginAttempt } from '@/lib/data/customers'
import { getStoreBySlug } from '@/lib/data/stores'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type EntrarState = { error: string | null; email: string }

const MESSAGES: Record<LoginFailure, string> = {
  invalid_email: 'Digite um e-mail válido.',
  admin_email: 'Este e-mail é de administrador. Entre por /admin/entrar.',
  not_found: 'Não encontramos compras com este e-mail. Confira se é o mesmo e-mail usado na compra.',
  blocked: 'Este acesso está suspenso. Fale com o suporte.',
  rate_limited: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
}

const GENERIC_ERROR = 'Não foi possível entrar agora. Tente novamente em instantes.'

export async function entrar(storeSlug: string, _prev: EntrarState, formData: FormData): Promise<EntrarState> {
  const email = String(formData.get('email') ?? '')
  const store = await getStoreBySlug(storeSlug)
  if (!store) return { error: GENERIC_ERROR, email }

  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido'
  const userAgent = h.get('user-agent') ?? ''

  const decision = await decideCustomerLogin(
    { email, ip },
    { adminEmails: env.adminEmails, countRecentAttempts: countRecentLoginAttempts, recordAttempt: recordLoginAttempt, findCustomerByEmail },
  )
  if (!decision.ok) return { error: MESSAGES[decision.reason], email }

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: decision.email })
  if (error) return { error: GENERIC_ERROR, email }

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'email', token_hash: data.properties.hashed_token })
  if (verifyError) return { error: GENERIC_ERROR, email }

  await recordDevice(decision.customerId, userAgent, ip)
  redirect(`/${store.slug}`)
}
```

Substituir `src/app/[loja]/entrar/form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import type { EntrarState } from './actions'

export function EntrarForm({
  action,
  initialEmail,
}: {
  action: (state: EntrarState, formData: FormData) => Promise<EntrarState>
  initialEmail: string
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, email: initialEmail })

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-texto-suave">
        E-mail usado na compra
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="rounded-md border border-borda bg-fundo px-4 py-3 text-base text-texto outline-none focus:border-destaque"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-md border border-destaque/40 bg-destaque/10 px-3 py-2 text-sm">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-md bg-destaque px-4 py-3 font-semibold text-white hover:bg-destaque-hover disabled:opacity-60">
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
```

Criar `src/app/[loja]/entrar/page.tsx`:

```tsx
import { getStore } from '@/lib/membros/session'
import { entrar } from './actions'
import { EntrarForm } from './form'

export const dynamic = 'force-dynamic'

export default async function EntrarPage({ params, searchParams }: PageProps<'/[loja]/entrar'>) {
  const [{ loja }, { email }] = await Promise.all([params, searchParams])
  const store = await getStore(loja)

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-borda bg-superficie p-6">
        <p className="text-sm text-texto-suave">{store.name}</p>
        <h1 className="text-2xl font-bold">Entrar</h1>
        <EntrarForm action={entrar.bind(null, store.slug)} initialEmail={typeof email === 'string' ? email : ''} />
      </div>
    </main>
  )
}
```

- [ ] **Step 9: Raiz, login antigo, sair e proxy**

Substituir `src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { env } from '@/lib/env'

export default function Home() {
  redirect(`/${env.defaultStoreSlug}`)
}
```

Substituir `src/app/entrar/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { env } from '@/lib/env'

export default async function EntrarLegado({ searchParams }: PageProps<'/entrar'>) {
  const { email } = await searchParams
  const query = typeof email === 'string' && email ? `?email=${encodeURIComponent(email)}` : ''
  redirect(`/${env.defaultStoreSlug}/entrar${query}`)
}
```

Substituir `src/app/sair/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { isValidStoreSlug } from '@/lib/content/slug'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const params = new URL(request.url).searchParams
  const loja = params.get('loja')
  const target =
    params.get('para') === 'admin'
      ? '/admin/entrar'
      : `/${loja && isValidStoreSlug(loja) ? loja : env.defaultStoreSlug}/entrar`
  return NextResponse.redirect(new URL(target, request.url), { status: 303 })
}
```

Substituir `src/lib/supabase/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { protectedStoreSlug } from '@/lib/membros/paths'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
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
  })

  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims)
  const path = request.nextUrl.pathname

  const storeSlug = protectedStoreSlug(path)
  const needsAdmin = path.startsWith('/admin') && !path.startsWith('/admin/entrar')

  if (!signedIn && (storeSlug || needsAdmin)) {
    const url = request.nextUrl.clone()
    url.pathname = needsAdmin ? '/admin/entrar' : `/${storeSlug}/entrar`
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
```

Remover a vitrine antiga:

```bash
git rm src/app/vitrine/cover.tsx src/app/vitrine/locked-card.tsx
```

- [ ] **Step 10: Verificar tudo**

Run: `npm test` → Expected: PASS.
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: concluído, com as rotas `/[loja]`, `/[loja]/produto/[slug]`, `/[loja]/item/[id]`, `/[loja]/entrar`.

- [ ] **Step 11: Conferir no navegador**

Run: `npm run dev`. Com o MCP Playwright, em 375px e 1440px:
1. Abrir `http://localhost:3000/` → redireciona para `/arquitetura/entrar`.
2. Entrar com o cliente de teste `grupoelevamax@gmail.com` → vitrine escura com destaque, "Seus produtos" e "Desbloqueie mais".
3. Tocar num produto bloqueado → janela com "Quero acessar".
4. Abrir um produto liberado → página com banner e cards de itens.
5. Clicar num item arquivo → abre nova aba com o link do item.
6. Tirar screenshots em `docs/design/cuspidora-vitrine-375.png` e `cuspidora-vitrine-1440.png`.

- [ ] **Step 12: Commit**

```bash
git add -A "src/app/[loja]" src/app/page.tsx src/app/entrar src/app/sair src/app/vitrine src/lib/membros src/lib/data/item-access.ts src/lib/supabase/proxy.ts src/components/membros/episode-card.tsx tests/membros docs/design/cuspidora-vitrine-375.png docs/design/cuspidora-vitrine-1440.png
git commit -m "feat: vitrine Netflix por loja, página do produto e abertura de itens com registro"
```

---

### Task 7: Login com proteção anti-robô, layout novo e WhatsApp contextual

**Executor:** Subagente Claude (frente B).

**Files:**
- Create: `src/lib/auth/login-guard.ts`, `src/lib/auth/turnstile.ts`, `src/lib/data/login-attempts.ts`
- Create: `tests/auth/login-guard.test.ts`, `tests/auth/turnstile.test.ts`
- Modify: `src/lib/auth/customer-login.ts`, `tests/auth/customer-login.test.ts` (arquivos inteiros)
- Modify: `src/lib/data/orders.ts` (acrescentar `hasPaidOrderInStore`)
- Modify: `src/lib/data/customers.ts` (remover `LOGIN_WINDOW_MINUTES`, `countRecentLoginAttempts`, `recordLoginAttempt`)
- Modify: `src/app/[loja]/entrar/page.tsx`, `form.tsx`, `actions.ts` (arquivos inteiros)

**Interfaces:**
- Consumes: `env.loginGuardSecret`, `env.turnstileSiteKey`, `env.turnstileSecretKey` (Task 1); `coverGradient`, `supportHref`, `WhatsAppFloating` (Task 5); `getStore` (Task 6).
- Produces:
  - `@/lib/auth/login-guard`: `GUARD`, `signFormStamp(issuedAtMs, secret)`, `freshFormStamp(secret)`, `checkFormStamp(stamp, nowMs, secret): 'ok' | 'too_fast' | 'invalid'`, `hashEmail(email, secret)`, `progressiveDelayMs(previousAttempts)`.
  - `@/lib/auth/turnstile`: `verifyTurnstile(token, ip, secret, fetchImpl?)`.
  - `@/lib/auth/customer-login`: `type LoginFailure` (+ `'bot'`), `type LoginInput`, `type LoginDeps`, `decideCustomerLogin(input, deps)`.
  - `@/lib/data/login-attempts`: `countLoginAttemptsByIp(ip, sinceIso)`, `countLoginAttemptsByEmailHash(hash, sinceIso)`, `recordLoginAttempt({ ip, emailHash, storeId })`.
  - `@/lib/data/orders`: `hasPaidOrderInStore(email, storeId): Promise<boolean>`.

- [ ] **Step 1: Escrever os testes**

Criar `tests/auth/login-guard.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { checkFormStamp, freshFormStamp, GUARD, hashEmail, progressiveDelayMs, signFormStamp } from '@/lib/auth/login-guard'

const SECRET = 'segredo'

describe('carimbo do formulário', () => {
  it('aceita depois do tempo mínimo', () => {
    expect(checkFormStamp(signFormStamp(1_000_000, SECRET), 1_000_000 + GUARD.minFillMs, SECRET)).toBe('ok')
  })

  it('carimbo novo usa o horário atual', () => {
    expect(checkFormStamp(freshFormStamp(SECRET), Date.now() + GUARD.minFillMs, SECRET)).toBe('ok')
  })

  it('recusa envio rápido demais', () => {
    expect(checkFormStamp(signFormStamp(1_000_000, SECRET), 1_000_500, SECRET)).toBe('too_fast')
  })

  it('recusa carimbo adulterado, de outro segredo, vencido ou malformado', () => {
    const stamp = signFormStamp(1_000_000, SECRET)
    expect(checkFormStamp(stamp.replace('1000000', '999000'), 1_010_000, SECRET)).toBe('invalid')
    expect(checkFormStamp(signFormStamp(1_000_000, 'outro'), 1_010_000, SECRET)).toBe('invalid')
    expect(checkFormStamp(stamp, 1_000_000 + GUARD.maxFormAgeMs + 1, SECRET)).toBe('invalid')
    expect(checkFormStamp('', 1_010_000, SECRET)).toBe('invalid')
    expect(checkFormStamp('abc.def', 1_010_000, SECRET)).toBe('invalid')
  })
})

describe('hashEmail', () => {
  it('é estável e não contém o e-mail', () => {
    const hash = hashEmail('joao@gmail.com', SECRET)
    expect(hash).toBe(hashEmail('joao@gmail.com', SECRET))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('progressiveDelayMs', () => {
  it('começa na 3ª tentativa e tem teto', () => {
    expect(progressiveDelayMs(0)).toBe(0)
    expect(progressiveDelayMs(1)).toBe(0)
    expect(progressiveDelayMs(2)).toBe(700)
    expect(progressiveDelayMs(3)).toBe(1400)
    expect(progressiveDelayMs(10)).toBe(3000)
  })
})
```

Criar `tests/auth/turnstile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { verifyTurnstile } from '@/lib/auth/turnstile'

function fakeFetch(response: { ok: boolean; body: unknown } | Error) {
  const calls: { url: string; body: string }[] = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body) })
    if (response instanceof Error) throw response
    return { ok: response.ok, json: async () => response.body } as Response
  }) as typeof fetch
  return { impl, calls }
}

describe('verifyTurnstile', () => {
  it('aprova quando a Cloudflare confirma', async () => {
    const { impl, calls } = fakeFetch({ ok: true, body: { success: true } })
    expect(await verifyTurnstile('token', '1.2.3.4', 'secret', impl)).toBe(true)
    expect(calls[0].url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(calls[0].body).toContain('response=token')
    expect(calls[0].body).toContain('remoteip=1.2.3.4')
  })

  it('recusa token vazio sem chamar a Cloudflare', async () => {
    const { impl, calls } = fakeFetch({ ok: true, body: { success: true } })
    expect(await verifyTurnstile('', '1.2.3.4', 'secret', impl)).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('recusa quando a Cloudflare nega, responde erro ou está fora do ar', async () => {
    expect(await verifyTurnstile('t', 'x', 's', fakeFetch({ ok: true, body: { success: false } }).impl)).toBe(false)
    expect(await verifyTurnstile('t', 'x', 's', fakeFetch({ ok: false, body: {} }).impl)).toBe(false)
    expect(await verifyTurnstile('t', 'x', 's', fakeFetch(new Error('rede')).impl)).toBe(false)
  })
})
```

Substituir `tests/auth/customer-login.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isAdminEmail } from '@/lib/auth/admin'
import { decideCustomerLogin, type LoginDeps, type LoginInput } from '@/lib/auth/customer-login'
import { GUARD, hashEmail, signFormStamp } from '@/lib/auth/login-guard'
import type { CustomerRow } from '@/lib/domain/types'

const SECRET = 'segredo'
const NOW = 1_800_000_000_000
const joao: CustomerRow = { id: 'c1', email: 'joao@gmail.com', name: 'João', blockedAt: null }

function input(extra: Partial<LoginInput> = {}): LoginInput {
  return {
    email: 'joao@gmail.com', ip: '1.1.1.1', honeypot: '', stamp: signFormStamp(NOW - 5_000, SECRET),
    turnstileToken: '', storeId: 's1', ...extra,
  }
}

function setup(o: { ipAttempts?: number; emailAttempts?: number; customers?: CustomerRow[]; paidIn?: string[]; turnstile?: boolean } = {}) {
  const recorded: { ip: string; emailHash: string | null; storeId: string }[] = []
  const slept: number[] = []
  const customers = o.customers ?? [joao]
  const deps: LoginDeps = {
    adminEmails: ['dono@gmail.com'],
    guardSecret: SECRET,
    now: () => NOW,
    countAttemptsByIp: async () => o.ipAttempts ?? 0,
    countAttemptsByEmailHash: async () => o.emailAttempts ?? 0,
    recordAttempt: async (entry) => {
      recorded.push(entry)
    },
    sleep: async (ms) => {
      slept.push(ms)
    },
    verifyTurnstile: o.turnstile === undefined ? null : async () => o.turnstile as boolean,
    findCustomerByEmail: async (email) => customers.find((c) => c.email === email) ?? null,
    hasPaidOrderInStore: async (email, storeId) => (o.paidIn ?? ['joao@gmail.com|s1']).includes(`${email}|${storeId}`),
  }
  return { deps, recorded, slept }
}

describe('decideCustomerLogin', () => {
  it('entra com e-mail de cliente que comprou na loja, normalizando', async () => {
    const { deps, recorded } = setup()
    expect(await decideCustomerLogin(input({ email: ' JOAO@gmail.com ' }), deps)).toEqual({ ok: true, email: 'joao@gmail.com', customerId: 'c1' })
    expect(recorded).toEqual([{ ip: '1.1.1.1', emailHash: hashEmail('joao@gmail.com', SECRET), storeId: 's1' }])
  })

  it('campo-armadilha preenchido é robô e não registra tentativa', async () => {
    const { deps, recorded } = setup()
    expect(await decideCustomerLogin(input({ honeypot: 'http://spam' }), deps)).toEqual({ ok: false, reason: 'bot' })
    expect(recorded).toEqual([])
  })

  it('envio rápido demais ou carimbo inválido é robô', async () => {
    const { deps } = setup()
    expect(await decideCustomerLogin(input({ stamp: signFormStamp(NOW - 200, SECRET) }), deps)).toEqual({ ok: false, reason: 'bot' })
    expect(await decideCustomerLogin(input({ stamp: 'x' }), deps)).toEqual({ ok: false, reason: 'bot' })
  })

  it('bloqueia por IP depois do limite sem registrar', async () => {
    const { deps, recorded } = setup({ ipAttempts: GUARD.ipLimit })
    expect(await decideCustomerLogin(input(), deps)).toEqual({ ok: false, reason: 'rate_limited' })
    expect(recorded).toEqual([])
  })

  it('recusa e-mail inválido registrando a tentativa sem hash', async () => {
    const { deps, recorded } = setup()
    expect(await decideCustomerLogin(input({ email: 'joao' }), deps)).toEqual({ ok: false, reason: 'invalid_email' })
    expect(recorded).toEqual([{ ip: '1.1.1.1', emailHash: null, storeId: 's1' }])
  })

  it('bloqueia por e-mail depois do limite', async () => {
    const { deps } = setup({ emailAttempts: GUARD.emailLimit })
    expect(await decideCustomerLogin(input(), deps)).toEqual({ ok: false, reason: 'rate_limited' })
  })

  it('atrasa a partir da 3ª tentativa do mesmo e-mail', async () => {
    const first = setup({ emailAttempts: 0 })
    await decideCustomerLogin(input(), first.deps)
    expect(first.slept).toEqual([])
    const third = setup({ emailAttempts: 2 })
    await decideCustomerLogin(input(), third.deps)
    expect(third.slept).toEqual([700])
  })

  it('Turnstile ligado recusa token inválido e aceita válido', async () => {
    expect(await decideCustomerLogin(input(), setup({ turnstile: false }).deps)).toEqual({ ok: false, reason: 'bot' })
    expect(await decideCustomerLogin(input(), setup({ turnstile: true }).deps)).toMatchObject({ ok: true })
  })

  it('recusa e-mail de admin', async () => {
    expect(await decideCustomerLogin(input({ email: 'Dono@gmail.com' }), setup().deps)).toEqual({ ok: false, reason: 'admin_email' })
  })

  it('recusa quem não existe ou não comprou nesta loja', async () => {
    expect(await decideCustomerLogin(input({ email: 'maria@gmail.com' }), setup().deps)).toEqual({ ok: false, reason: 'not_found' })
    expect(await decideCustomerLogin(input(), setup({ paidIn: [] }).deps)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('recusa cliente bloqueado', async () => {
    const { deps } = setup({ customers: [{ ...joao, blockedAt: '2026-09-16T00:00:00Z' }] })
    expect(await decideCustomerLogin(input(), deps)).toEqual({ ok: false, reason: 'blocked' })
  })
})

describe('isAdminEmail', () => {
  it('compara normalizado', () => {
    expect(isAdminEmail(' DONO@gmail.com', ['dono@gmail.com'])).toBe(true)
    expect(isAdminEmail('joao@gmail.com', ['dono@gmail.com'])).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/auth`
Expected: FAIL — `login-guard`, `turnstile` inexistentes; assinatura de `decideCustomerLogin` diferente.

- [ ] **Step 3: Implementar `src/lib/auth/login-guard.ts`**

```ts
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const GUARD = {
  minFillMs: 1500,
  maxFormAgeMs: 2 * 60 * 60 * 1000,
  ipLimit: 20,
  emailLimit: 5,
  windowMinutes: 10,
  delayFromAttempt: 3,
  delayStepMs: 700,
  maxDelayMs: 3000,
} as const

function mac(issuedAtMs: number, secret: string): string {
  return createHmac('sha256', secret).update(String(issuedAtMs)).digest('hex')
}

export function signFormStamp(issuedAtMs: number, secret: string): string {
  return `${issuedAtMs}.${mac(issuedAtMs, secret)}`
}

export function freshFormStamp(secret: string): string {
  return signFormStamp(Date.now(), secret)
}

export function checkFormStamp(stamp: string, nowMs: number, secret: string): 'ok' | 'too_fast' | 'invalid' {
  const parts = stamp.split('.')
  if (parts.length !== 2) return 'invalid'
  const issuedAt = Number(parts[0])
  if (!parts[0] || !Number.isSafeInteger(issuedAt)) return 'invalid'

  const expected = Buffer.from(mac(issuedAt, secret))
  const received = Buffer.from(parts[1])
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return 'invalid'

  const age = nowMs - issuedAt
  if (age < 0 || age > GUARD.maxFormAgeMs) return 'invalid'
  return age < GUARD.minFillMs ? 'too_fast' : 'ok'
}

export function hashEmail(email: string, secret: string): string {
  return createHash('sha256').update(`${secret}:${email}`).digest('hex')
}

export function progressiveDelayMs(previousAttempts: number): number {
  const over = previousAttempts + 1 - GUARD.delayFromAttempt
  return over < 0 ? 0 : Math.min(GUARD.maxDelayMs, (over + 1) * GUARD.delayStepMs)
}
```

- [ ] **Step 4: Implementar `src/lib/auth/turnstile.ts`**

```ts
export async function verifyTurnstile(token: string, ip: string, secret: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!token) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip && ip !== 'desconhecido') body.set('remoteip', ip)
    const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
    if (!response.ok) return false
    const data = (await response.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Substituir `src/lib/auth/customer-login.ts`**

```ts
import { isAdminEmail } from '@/lib/auth/admin'
import { checkFormStamp, GUARD, hashEmail, progressiveDelayMs } from '@/lib/auth/login-guard'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'
import type { CustomerRow } from '@/lib/domain/types'

export type LoginFailure = 'bot' | 'invalid_email' | 'admin_email' | 'not_found' | 'blocked' | 'rate_limited'

export type LoginDecision = { ok: true; email: string; customerId: string } | { ok: false; reason: LoginFailure }

export type LoginInput = {
  email: string
  ip: string
  honeypot: string
  stamp: string
  turnstileToken: string
  storeId: string
}

export type LoginDeps = {
  adminEmails: string[]
  guardSecret: string
  now(): number
  countAttemptsByIp(ip: string, sinceIso: string): Promise<number>
  countAttemptsByEmailHash(hash: string, sinceIso: string): Promise<number>
  recordAttempt(entry: { ip: string; emailHash: string | null; storeId: string }): Promise<void>
  sleep(ms: number): Promise<void>
  verifyTurnstile: ((token: string, ip: string) => Promise<boolean>) | null
  findCustomerByEmail(email: string): Promise<CustomerRow | null>
  hasPaidOrderInStore(email: string, storeId: string): Promise<boolean>
}

export async function decideCustomerLogin(input: LoginInput, deps: LoginDeps): Promise<LoginDecision> {
  if (input.honeypot.trim() !== '') return { ok: false, reason: 'bot' }
  if (checkFormStamp(input.stamp, deps.now(), deps.guardSecret) !== 'ok') return { ok: false, reason: 'bot' }

  const since = new Date(deps.now() - GUARD.windowMinutes * 60_000).toISOString()
  if ((await deps.countAttemptsByIp(input.ip, since)) >= GUARD.ipLimit) return { ok: false, reason: 'rate_limited' }

  const email = normalizeEmail(input.email)
  if (!isValidEmail(email)) {
    await deps.recordAttempt({ ip: input.ip, emailHash: null, storeId: input.storeId })
    return { ok: false, reason: 'invalid_email' }
  }

  const emailHash = hashEmail(email, deps.guardSecret)
  const previous = await deps.countAttemptsByEmailHash(emailHash, since)
  if (previous >= GUARD.emailLimit) return { ok: false, reason: 'rate_limited' }
  await deps.recordAttempt({ ip: input.ip, emailHash, storeId: input.storeId })

  const delay = progressiveDelayMs(previous)
  if (delay > 0) await deps.sleep(delay)

  if (deps.verifyTurnstile && !(await deps.verifyTurnstile(input.turnstileToken, input.ip))) return { ok: false, reason: 'bot' }
  if (isAdminEmail(email, deps.adminEmails)) return { ok: false, reason: 'admin_email' }

  const customer = await deps.findCustomerByEmail(email)
  if (!customer || !(await deps.hasPaidOrderInStore(email, input.storeId))) return { ok: false, reason: 'not_found' }
  if (customer.blockedAt) return { ok: false, reason: 'blocked' }

  return { ok: true, email, customerId: customer.id }
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run tests/auth`
Expected: PASS.

- [ ] **Step 7: Dados de tentativas e compra na loja**

Criar `src/lib/data/login-attempts.ts`:

```ts
import { createAdminClient } from '@/lib/supabase/admin'

export async function countLoginAttemptsByIp(ip: string, sinceIso: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', sinceIso)
  if (error) throw error
  return count ?? 0
}

export async function countLoginAttemptsByEmailHash(hash: string, sinceIso: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email_hash', hash)
    .gte('created_at', sinceIso)
  if (error) throw error
  return count ?? 0
}

export async function recordLoginAttempt(entry: { ip: string; emailHash: string | null; storeId: string }): Promise<void> {
  const { error } = await createAdminClient()
    .from('login_attempts')
    .insert({ ip: entry.ip, email_hash: entry.emailHash, store_id: entry.storeId })
  if (error) throw error
}
```

Em `src/lib/data/customers.ts`, apagar `LOGIN_WINDOW_MINUTES`, `countRecentLoginAttempts` e `recordLoginAttempt` (linhas 50–66 do arquivo original).

Em `src/lib/data/orders.ts`, acrescentar:

```ts
export async function hasPaidOrderInStore(email: string, storeId: string): Promise<boolean> {
  const db = createAdminClient()
  const { data: orders, error } = await db
    .from('orders')
    .select('payt_product_code')
    .eq('customer_email', email)
    .eq('status', 'pago')
  if (error) throw error
  const codes = [...new Set(orders.map((o) => o.payt_product_code as string))]
  if (codes.length === 0) return false

  const { count, error: offersError } = await db
    .from('offers')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .in('payt_product_code', codes)
  if (offersError) throw offersError
  return (count ?? 0) > 0
}
```

- [ ] **Step 8: Ação de login**

Substituir `src/app/[loja]/entrar/actions.ts`:

```ts
'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { decideCustomerLogin, type LoginFailure } from '@/lib/auth/customer-login'
import { verifyTurnstile } from '@/lib/auth/turnstile'
import { findCustomerByEmail, recordDevice } from '@/lib/data/customers'
import { countLoginAttemptsByEmailHash, countLoginAttemptsByIp, recordLoginAttempt } from '@/lib/data/login-attempts'
import { hasPaidOrderInStore } from '@/lib/data/orders'
import { getStoreBySlug } from '@/lib/data/stores'
import { normalizeEmail } from '@/lib/domain/email'
import { env } from '@/lib/env'
import { supportHref } from '@/lib/support/whatsapp'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type EntrarState = { error: string | null; email: string; supportHref: string | null }

const MESSAGES: Record<LoginFailure, string> = {
  bot: 'Não foi possível validar o envio. Recarregue a página e tente novamente.',
  invalid_email: 'Digite um e-mail válido.',
  admin_email: 'Este e-mail é de administrador. Entre por /admin/entrar.',
  not_found: 'Não encontramos compras com este e-mail nesta loja. Confira se é o mesmo e-mail usado na compra.',
  blocked: 'Este acesso está suspenso. Fale com o suporte.',
  rate_limited: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
}

const GENERIC_ERROR = 'Não foi possível entrar agora. Tente novamente em instantes.'

export async function entrar(storeSlug: string, _prev: EntrarState, formData: FormData): Promise<EntrarState> {
  const email = String(formData.get('email') ?? '')
  const store = await getStoreBySlug(storeSlug)
  if (!store) return { error: GENERIC_ERROR, email, supportHref: null }

  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido'
  const userAgent = h.get('user-agent') ?? ''
  const siteKey = env.turnstileSiteKey
  const secretKey = env.turnstileSecretKey

  const decision = await decideCustomerLogin(
    {
      email,
      ip,
      honeypot: String(formData.get('website') ?? ''),
      stamp: String(formData.get('stamp') ?? ''),
      turnstileToken: String(formData.get('cf-turnstile-response') ?? ''),
      storeId: store.id,
    },
    {
      adminEmails: env.adminEmails,
      guardSecret: env.loginGuardSecret,
      now: () => Date.now(),
      countAttemptsByIp: countLoginAttemptsByIp,
      countAttemptsByEmailHash: countLoginAttemptsByEmailHash,
      recordAttempt: recordLoginAttempt,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      verifyTurnstile: siteKey && secretKey ? (token, remoteIp) => verifyTurnstile(token, remoteIp, secretKey) : null,
      findCustomerByEmail,
      hasPaidOrderInStore,
    },
  )

  if (!decision.ok) {
    const context = decision.reason === 'not_found' || decision.reason === 'blocked' ? 'nao_encontrado' : 'geral'
    const typed = normalizeEmail(email)
    return { error: MESSAGES[decision.reason], email, supportHref: supportHref(store, context, typed || null) }
  }

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: decision.email })
  if (error) return { error: GENERIC_ERROR, email, supportHref: null }

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'email', token_hash: data.properties.hashed_token })
  if (verifyError) return { error: GENERIC_ERROR, email, supportHref: null }

  await recordDevice(decision.customerId, userAgent, ip)
  redirect(`/${store.slug}`)
}
```

- [ ] **Step 9: Formulário**

Substituir `src/app/[loja]/entrar/form.tsx`:

```tsx
'use client'

import Script from 'next/script'
import { useActionState, useEffect } from 'react'
import type { EntrarState } from './actions'

type TurnstileWindow = Window & { turnstile?: { reset(): void } }

export function EntrarForm({
  action,
  initialEmail,
  stamp,
  turnstileSiteKey,
}: {
  action: (state: EntrarState, formData: FormData) => Promise<EntrarState>
  initialEmail: string
  stamp: string
  turnstileSiteKey: string | null
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, email: initialEmail, supportHref: null })

  useEffect(() => {
    if (state.error) (window as TurnstileWindow).turnstile?.reset()
  }, [state])

  return (
    <form action={formAction} className="relative mt-5 flex flex-col gap-4">
      <input type="hidden" name="stamp" value={stamp} />
      <div className="absolute top-0 -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-texto-suave">
        E-mail
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.email}
          disabled={pending}
          className="rounded-md border border-borda bg-fundo px-4 py-3 text-base text-texto outline-none focus:border-destaque"
        />
      </label>

      {state.error && (
        <div role="alert" className="rounded-md border border-destaque/40 bg-destaque/10 px-3 py-2 text-sm text-texto">
          <p>{state.error}</p>
          {state.supportHref && (
            <a href={state.supportHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-semibold underline underline-offset-4">
              Falar com o suporte
            </a>
          )}
        </div>
      )}

      {turnstileSiteKey && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="dark" data-size="flexible" />
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-md bg-destaque px-4 py-3 font-semibold text-white hover:bg-destaque-hover disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
```

- [ ] **Step 10: Página no layout de referência (imagem à esquerda, formulário à direita)**

Substituir `src/app/[loja]/entrar/page.tsx`:

```tsx
import { WhatsAppFloating } from '@/components/membros/whatsapp-button'
import { freshFormStamp } from '@/lib/auth/login-guard'
import { coverGradient } from '@/lib/content/cover'
import { env } from '@/lib/env'
import { getStore } from '@/lib/membros/session'
import { supportHref } from '@/lib/support/whatsapp'
import { entrar } from './actions'
import { EntrarForm } from './form'

export const dynamic = 'force-dynamic'

function Backdrop({ imageUrl, seed }: { imageUrl: string | null; seed: string }) {
  return imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
  ) : (
    <div className="absolute inset-0" style={{ backgroundImage: coverGradient(seed) }} />
  )
}

export default async function EntrarPage({ params, searchParams }: PageProps<'/[loja]/entrar'>) {
  const [{ loja }, { email }] = await Promise.all([params, searchParams])
  const store = await getStore(loja)
  const stamp = freshFormStamp(env.loginGuardSecret)
  const support = supportHref(store, 'geral')

  return (
    <div className="relative flex min-h-dvh">
      <div className="absolute inset-0 overflow-hidden lg:hidden" aria-hidden>
        <Backdrop imageUrl={store.loginImageUrl} seed={store.id} />
        <div className="absolute inset-0 bg-gradient-to-b from-fundo/60 via-fundo/85 to-fundo" />
      </div>

      <aside className="relative hidden flex-1 overflow-hidden lg:block">
        <Backdrop imageUrl={store.loginImageUrl} seed={store.id} />
        <div className="absolute inset-0 bg-gradient-to-r from-fundo/40 via-fundo/50 to-fundo" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-12 xl:p-16">
          <span className="w-fit rounded-full border border-borda bg-superficie/70 px-3 py-1 text-xs text-texto-suave">Área de membros</span>
          <h2 className="max-w-xl text-4xl leading-tight font-bold xl:text-5xl">
            Seus materiais em <span className="text-destaque">um só lugar</span>
          </h2>
          <p className="max-w-lg text-sm text-texto-suave">Acesse tudo o que você comprou em {store.name}, no celular ou no computador.</p>
        </div>
      </aside>

      <div className="relative flex w-full flex-col justify-center px-4 py-10 sm:px-6 lg:w-[30rem] lg:shrink-0 lg:border-l lg:border-borda lg:bg-superficie lg:px-10 xl:w-[34rem]">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex items-center justify-center gap-3 lg:justify-start">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="h-10 w-auto" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-md bg-destaque text-lg font-bold text-white">
                {store.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-lg font-semibold">{store.name}</span>
          </div>

          <div className="rounded-2xl border border-borda bg-superficie/90 p-5 shadow-2xl backdrop-blur lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
            <h1 className="text-lg font-semibold">Entrar</h1>
            <p className="mt-1 text-sm text-texto-suave">Use o e-mail da sua compra. Sem senha.</p>
            <EntrarForm
              action={entrar.bind(null, store.slug)}
              initialEmail={typeof email === 'string' ? email : ''}
              stamp={stamp}
              turnstileSiteKey={env.turnstileSiteKey && env.turnstileSecretKey ? env.turnstileSiteKey : null}
            />
          </div>
        </div>
      </div>

      <WhatsAppFloating href={support} />
    </div>
  )
}
```

- [ ] **Step 11: Verificar tudo**

Run: `git grep -n "countRecentLoginAttempts\|recordLoginAttempt(ip" -- src tests` → Expected: nenhuma ocorrência.
Run: `npm test` → Expected: PASS.
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: concluído.

- [ ] **Step 12: Conferir no navegador**

Run: `npm run dev`. Com o MCP Playwright:
1. `/arquitetura/entrar` em 1440px: imagem/gradiente à esquerda, painel à direita. Em 375px: fundo com cartão centralizado. Screenshots em `docs/design/cuspidora-login-1440.png` e `cuspidora-login-375.png`.
2. Enviar imediatamente após carregar (script `browser_evaluate` preenchendo e submetendo em < 1 s) → mensagem "Não foi possível validar o envio".
3. Aguardar 2 s e entrar com `maria-inexistente@example.com` → mensagem de "nesta loja" + link "Falar com o suporte" (se a loja tiver WhatsApp ou link de suporte cadastrado).
4. Entrar com `grupoelevamax@gmail.com` → vitrine.

- [ ] **Step 13: Commit**

```bash
git add -A src/lib/auth src/lib/data/login-attempts.ts src/lib/data/orders.ts src/lib/data/customers.ts "src/app/[loja]/entrar" tests/auth docs/design/cuspidora-login-1440.png docs/design/cuspidora-login-375.png
git commit -m "feat: login por loja com anti-robô, limite por e-mail, Turnstile opcional e WhatsApp"
```

---

### Task 8: Instalar app (PWA)

**Executor:** Subagente Claude (frente B).

**Files:**
- Create: `src/app/[loja]/manifest.webmanifest/route.ts`, `src/app/icons/[loja]/[size]/route.tsx`
- Create: `src/components/membros/install-app-button.tsx`
- Create: `public/sw.js`, `public/offline.html`
- Modify: `src/app/[loja]/layout.tsx` (função `generateMetadata`)
- Modify: `src/app/[loja]/page.tsx`, `src/app/[loja]/produto/[slug]/page.tsx`, `src/app/[loja]/item/[id]/page.tsx` (passar `actions={<InstallAppButton />}` ao `StoreHeader`)
- Modify: `src/app/[loja]/entrar/page.tsx` (botão abaixo do cartão)
- Modify: `src/proxy.ts` (matcher), `eslint.config.mjs` (ignorar `public/sw.js`)

**Interfaces:**
- Consumes: `getStore` (Task 6), `getStoreBySlug`, `isValidStoreSlug`, `DownloadIcon`.
- Produces: `InstallAppButton`; rotas `/[loja]/manifest.webmanifest`, `/icons/[loja]/192|512|maskable`, `/sw.js`, `/offline.html`.

- [ ] **Step 1: Manifesto por loja**

Criar `src/app/[loja]/manifest.webmanifest/route.ts`:

```ts
import { isValidStoreSlug } from '@/lib/content/slug'
import { getStoreBySlug } from '@/lib/data/stores'

export async function GET(_request: Request, { params }: { params: Promise<{ loja: string }> }) {
  const { loja } = await params
  const store = isValidStoreSlug(loja) ? await getStoreBySlug(loja) : null
  if (!store) return new Response('Not found', { status: 404 })

  const manifest = {
    id: `/${store.slug}`,
    name: store.name,
    short_name: store.name.slice(0, 12),
    start_url: `/${store.slug}`,
    scope: `/${store.slug}`,
    display: 'standalone',
    background_color: '#0b0b0c',
    theme_color: '#0b0b0c',
    lang: 'pt-BR',
    icons: [
      { src: `/icons/${store.slug}/192`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/icons/${store.slug}/512`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/icons/${store.slug}/maskable`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  })
}
```

- [ ] **Step 2: Ícones gerados**

Criar `src/app/icons/[loja]/[size]/route.tsx`:

```tsx
import { ImageResponse } from 'next/og'
import { isValidStoreSlug } from '@/lib/content/slug'
import { getStoreBySlug } from '@/lib/data/stores'

const SIZES: Record<string, { size: number; padding: number }> = {
  '192': { size: 192, padding: 0 },
  '512': { size: 512, padding: 0 },
  maskable: { size: 512, padding: 100 },
}

export async function GET(_request: Request, { params }: { params: Promise<{ loja: string; size: string }> }) {
  const { loja, size } = await params
  const spec = SIZES[size]
  const store = spec && isValidStoreSlug(loja) ? await getStoreBySlug(loja) : null
  if (!spec || !store) return new Response('Not found', { status: 404 })

  const inner = spec.size - spec.padding * 2
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0b0c' }}>
        <div
          style={{
            width: inner,
            height: inner,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#e11d2e',
            borderRadius: spec.padding ? inner / 2 : inner * 0.2,
            color: '#ffffff',
            fontSize: inner * 0.55,
            fontWeight: 700,
          }}
        >
          {store.name.charAt(0).toUpperCase()}
        </div>
      </div>
    ),
    { width: spec.size, height: spec.size, headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
```

- [ ] **Step 3: Service worker mínimo e página offline**

Criar `public/sw.js`:

```js
const OFFLINE_CACHE = 'offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)))
})
```

Criar `public/offline.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sem conexão</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b0b0c; color: #f5f5f5; font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
      p { color: #a1a1aa; }
      button { margin-top: 16px; background: #e11d2e; color: #fff; border: 0; border-radius: 6px; padding: 12px 20px; font-weight: 600; font-size: 16px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Você está sem internet</h1>
      <p>Conecte-se para acessar seus produtos.</p>
      <button type="button" onclick="location.reload()">Tentar de novo</button>
    </main>
  </body>
</html>
```

Em `eslint.config.mjs`, acrescentar `"public/sw.js",` dentro de `globalIgnores([...])`, logo após `"next-env.d.ts",`.

Em `src/proxy.ts`, substituir o `matcher` por:

```ts
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks|sw.js|offline.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
```

- [ ] **Step 4: Botão "Instalar app"**

Criar `src/components/membros/install-app-button.tsx`:

```tsx
'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { DownloadIcon } from './icons'

type InstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const noopSubscribe = () => () => {}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function InstallAppButton({ className = '' }: { className?: string }) {
  const standalone = useSyncExternalStore(noopSubscribe, isStandalone, () => true)
  const ios = useSyncExternalStore(noopSubscribe, isIos, () => false)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (standalone || installed || (!installPrompt && !ios)) return null

  async function install() {
    if (!installPrompt) {
      setHelpOpen(true)
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setInstallPrompt(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-2 rounded-full border border-borda bg-superficie-2 px-3 py-1.5 text-sm font-medium text-texto hover:bg-borda ${className}`}
      >
        <DownloadIcon />
        Instalar app
      </button>

      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="instalar-titulo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div className="painel-sobe w-full max-w-md rounded-t-xl bg-superficie p-6 sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="instalar-titulo" className="text-xl font-bold">Instalar no iPhone</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-texto-suave">
              <li>Abra este site no <strong className="text-texto">Safari</strong>.</li>
              <li>Toque em <strong className="text-texto">Compartilhar</strong> (o quadrado com uma seta para cima).</li>
              <li>Escolha <strong className="text-texto">Adicionar à Tela de Início</strong> e toque em <strong className="text-texto">Adicionar</strong>.</li>
            </ol>
            <button type="button" onClick={() => setHelpOpen(false)} className="mt-6 w-full rounded-md bg-destaque px-4 py-3 font-semibold text-white hover:bg-destaque-hover">
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 5: Ligar manifesto e botão nas telas**

Em `src/app/[loja]/layout.tsx`, substituir `generateMetadata` por:

```tsx
export async function generateMetadata({ params }: { params: Promise<{ loja: string }> }): Promise<Metadata> {
  const { loja } = await params
  const store = await getStore(loja)
  return {
    title: store.name,
    robots: { index: false, follow: false },
    manifest: `/${store.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: store.name, statusBarStyle: 'black-translucent' },
    icons: { apple: `/icons/${store.slug}/192` },
  }
}
```

Em `src/app/[loja]/page.tsx`, `src/app/[loja]/produto/[slug]/page.tsx` e `src/app/[loja]/item/[id]/page.tsx`:
- acrescentar `import { InstallAppButton } from '@/components/membros/install-app-button'`;
- trocar `<StoreHeader store={store} email={customer.email} />` por `<StoreHeader store={store} email={customer.email} actions={<InstallAppButton />} />`.

Em `src/app/[loja]/entrar/page.tsx`:
- acrescentar `import { InstallAppButton } from '@/components/membros/install-app-button'`;
- logo depois do `</div>` que fecha o cartão do formulário (o `div` com `rounded-2xl ... lg:backdrop-blur-none`), acrescentar:

```tsx
          <div className="mt-6 flex justify-center lg:justify-start">
            <InstallAppButton />
          </div>
```

- [ ] **Step 6: Verificar tudo**

Run: `npm test` → Expected: PASS.
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: concluído, com `/[loja]/manifest.webmanifest` e `/icons/[loja]/[size]`.

- [ ] **Step 7: Conferir no navegador**

Run: `npm run dev`. Com o MCP Playwright:
1. `GET /arquitetura/manifest.webmanifest` → JSON com `start_url: "/arquitetura"` e 3 ícones.
2. `GET /icons/arquitetura/512` → imagem PNG 512×512.
3. Em `/arquitetura` (logado), `browser_evaluate` com `navigator.serviceWorker.getRegistration().then(r => !!r)` → `true`.
4. Emular iPhone (user agent iOS, 375px) → botão "Instalar app" visível; clicar abre o passo a passo.

- [ ] **Step 8: Commit**

```bash
git add "src/app/[loja]" src/app/icons src/components/membros/install-app-button.tsx public/sw.js public/offline.html src/proxy.ts eslint.config.mjs
git commit -m "feat: instalação como app por loja com manifesto, ícones e service worker mínimo"
```

---

### Task 9: Admin — seletor de loja, lojas, produtos/módulos/itens e ofertas

**Executor:** Subagente Claude (frente C). Começa com a Task 5 em `main`.

**Files:**
- Create: `src/lib/admin/forms.ts`, `src/lib/admin/order.ts`, `src/lib/admin/current-store.ts`, `src/lib/admin/action-helpers.ts`, `src/lib/data/products-admin.ts`
- Create: `tests/admin/forms.test.ts`, `tests/admin/order.test.ts`
- Create: `src/app/admin/(painel)/loja-actions.ts`
- Create: `src/app/admin/(painel)/lojas/page.tsx`, `lojas/[id]/page.tsx`, `lojas/actions.ts`, `lojas/store-form.tsx`
- Create: `src/app/admin/(painel)/produtos/page.tsx`, `produtos/[id]/page.tsx`, `produtos/actions.ts`, `produtos/product-form.tsx`, `produtos/content-editor.tsx`
- Modify: `src/lib/data/stores.ts` (acrescentar `listStores`, `saveStore`), `src/lib/data/orders.ts` (`AdminOrder`, `listOrders`)
- Modify: `src/app/admin/(painel)/layout.tsx`, `src/app/admin/(painel)/pedidos/page.tsx`, `src/app/admin/entrar/page.tsx`, `src/app/admin/entrar/form.tsx` (arquivos inteiros)
- Modify: `src/app/admin/(painel)/ofertas/page.tsx`, `ofertas/[id]/page.tsx`, `ofertas/actions.ts`, `ofertas/offer-form.tsx` (arquivos inteiros)
- Modify: `src/app/admin/(painel)/clientes/actions.ts` (`reenviarAcesso` usa a loja do admin)
- Delete: `src/app/admin/(painel)/materiais/` (pasta inteira)

**Interfaces:**
- Consumes: Task 1 (`getStoreById`, `getStoreBySlug`, `getDefaultStore`, `listProducts`, `getProductById`, `listModulesWithItems`); Task 5 (`ui`, `AutoCover`, `slugify`, `isValidSlug`, `isValidStoreSlug`, `isHttpUrl`, `isUuid`, `toVideoEmbed`, `normalizeWhatsapp`). Em `clientes/actions.ts` só troca `getDefaultStore` por `getAdminStore` (vale com ou sem a Task 2 já em `main`).
- Produces:
  - `@/lib/admin/forms`: `FormError`, `StoreInput`/`parseStoreForm`, `ProductInput`/`parseProductForm`, `ModuleInput`/`parseModuleForm`, `ItemInput`/`parseItemForm`, `OfferInput`/`parseOfferForm`.
  - `@/lib/admin/order`: `moveInList(ids, id, direction)`.
  - `@/lib/admin/current-store`: `ADMIN_STORE_COOKIE`, `getAdminStore()`.
  - `@/lib/admin/action-helpers`: `errorText(e)`, `uploadIfPresent(value, current, upload)`, `withMessage(path, message)`.
  - `@/lib/data/products-admin`: `saveProduct`, `saveModule`, `deleteModule`, `moveModule`, `saveItem`, `deleteItem`, `moveItem`, `uploadImage`, `type AdminOffer`, `listOffers`, `getOffer`, `saveOffer`.
  - `@/lib/data/stores`: `listStores()`, `saveStore(input): Promise<string>`.
  - Layout do admin com links para `/admin/sucesso`, `/admin/avisos`, `/admin/emails` (páginas criadas nas Tasks 10 e 11).

- [ ] **Step 1: Escrever os testes**

Criar `tests/admin/order.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { moveInList } from '@/lib/admin/order'

describe('moveInList', () => {
  it('sobe e desce um item', () => {
    expect(moveInList(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c'])
    expect(moveInList(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b'])
  })

  it('não mexe nas pontas nem em id desconhecido', () => {
    expect(moveInList(['a', 'b'], 'a', 'up')).toEqual(['a', 'b'])
    expect(moveInList(['a', 'b'], 'b', 'down')).toEqual(['a', 'b'])
    expect(moveInList(['a', 'b'], 'x', 'up')).toEqual(['a', 'b'])
  })
})
```

Criar `tests/admin/forms.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { FormError, parseItemForm, parseModuleForm, parseOfferForm, parseProductForm, parseStoreForm } from '@/lib/admin/forms'

const UUID = '0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c'

function fd(entries: Record<string, string | string[]>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    for (const v of Array.isArray(value) ? value : [value]) form.append(key, v)
  }
  return form
}

describe('parseStoreForm', () => {
  it('gera o endereço a partir do nome e normaliza o WhatsApp', () => {
    expect(parseStoreForm(fd({ name: 'Nutrição Animal', support_whatsapp: '+55 11 99999-8888' }))).toEqual({
      id: null, slug: 'nutricao-animal', name: 'Nutrição Animal', logoUrl: null,
      supportWhatsapp: '5511999998888', supportUrl: null, loginImageUrl: null,
    })
  })

  it('recusa nome vazio, endereço reservado, WhatsApp e links inválidos', () => {
    expect(() => parseStoreForm(fd({ name: '' }))).toThrow(FormError)
    expect(() => parseStoreForm(fd({ name: 'X', slug: 'admin' }))).toThrow('Endereço inválido')
    expect(() => parseStoreForm(fd({ name: 'X', support_whatsapp: '123' }))).toThrow('WhatsApp inválido')
    expect(() => parseStoreForm(fd({ name: 'X', support_url: 'javascript:alert(1)' }))).toThrow('Link inválido')
  })
})

describe('parseProductForm', () => {
  it('lê campos, marcações e ordem', () => {
    expect(
      parseProductForm(
        fd({ title: 'Atlas Visual', description: ' texto ', checkout_url: 'https://payt.com/x', sort_order: '3', is_featured: 'on', is_published: 'on' }),
        's1',
      ),
    ).toEqual({
      id: null, storeId: 's1', slug: 'atlas-visual', title: 'Atlas Visual', description: 'texto',
      coverUrl: null, bannerUrl: null, checkoutUrl: 'https://payt.com/x', isFeatured: true, sortOrder: 3, isPublished: true,
    })
  })

  it('recusa título vazio e endereço inválido', () => {
    expect(() => parseProductForm(fd({ title: '' }), 's1')).toThrow('Informe o título')
    expect(() => parseProductForm(fd({ title: 'A', slug: 'Com Espaço' }), 's1')).toThrow('Endereço do produto inválido')
  })
})

describe('parseModuleForm', () => {
  it('lê o módulo', () => {
    expect(parseModuleForm(fd({ title: 'Módulo 1', product_id: UUID, is_published: 'on' }))).toEqual({
      id: null, productId: UUID, title: 'Módulo 1', isPublished: true,
    })
  })

  it('recusa nome vazio', () => {
    expect(() => parseModuleForm(fd({ title: ' ', product_id: UUID }))).toThrow('Informe o nome do módulo')
  })
})

describe('parseItemForm', () => {
  it('aceita vídeo reconhecido', () => {
    expect(parseItemForm(fd({ title: 'Aula 1', kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', module_id: UUID, is_published: 'on' }))).toEqual({
      id: null, moduleId: UUID, title: 'Aula 1', kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', coverUrl: null, isPublished: true,
    })
  })

  it('recusa vídeo não reconhecido, tipo inválido, link ausente e módulo inválido', () => {
    expect(() => parseItemForm(fd({ title: 'A', kind: 'video', url: 'https://drive.google.com/x', module_id: UUID }))).toThrow('Vídeo não reconhecido')
    expect(() => parseItemForm(fd({ title: 'A', kind: 'pdf', url: 'https://x.com', module_id: UUID }))).toThrow('Tipo de item inválido')
    expect(() => parseItemForm(fd({ title: 'A', kind: 'arquivo', module_id: UUID }))).toThrow('Informe o link')
    expect(() => parseItemForm(fd({ title: 'A', kind: 'arquivo', url: 'https://x.com', module_id: 'x' }))).toThrow('Registro inválido')
  })
})

describe('parseOfferForm', () => {
  it('lê código e produtos', () => {
    expect(parseOfferForm(fd({ name: 'Plano Completo', payt_product_code: 'ATLAS-COMPLETO', product_ids: [UUID] }), 's1')).toEqual({
      id: null, storeId: 's1', name: 'Plano Completo', paytProductCode: 'ATLAS-COMPLETO', productIds: [UUID],
    })
  })

  it('recusa código com espaço e produto inválido', () => {
    expect(() => parseOfferForm(fd({ name: 'X', payt_product_code: 'COM ESPACO' }), 's1')).toThrow('sem espaços')
    expect(() => parseOfferForm(fd({ name: 'X', payt_product_code: 'OK', product_ids: ['nao-uuid'] }), 's1')).toThrow('Produto inválido')
  })
})
```

Run: `npx vitest run tests/admin` → Expected: FAIL (módulos inexistentes).

- [ ] **Step 2: Implementar `src/lib/admin/order.ts` e `src/lib/admin/forms.ts`**

`src/lib/admin/order.ts`:

```ts
export function moveInList(ids: string[], id: string, direction: 'up' | 'down'): string[] {
  const index = ids.indexOf(id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= ids.length) return ids
  const next = [...ids]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
```

`src/lib/admin/forms.ts`:

```ts
import { isValidSlug, isValidStoreSlug, slugify } from '@/lib/content/slug'
import { isHttpUrl, isUuid } from '@/lib/content/url'
import { toVideoEmbed } from '@/lib/content/video'
import type { ItemKind } from '@/lib/domain/types'
import { normalizeWhatsapp } from '@/lib/support/whatsapp'

export class FormError extends Error {}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim()
}

function checked(form: FormData, name: string): boolean {
  return form.get(name) === 'on'
}

function optionalUrl(form: FormData, name: string, label: string): string | null {
  const value = text(form, name)
  if (!value) return null
  if (!isHttpUrl(value)) throw new FormError(`Link inválido em "${label}". Use um endereço começando com https://.`)
  return value
}

function optionalId(form: FormData, name: string): string | null {
  const value = text(form, name)
  if (!value) return null
  if (!isUuid(value)) throw new FormError('Registro inválido.')
  return value
}

function requiredId(form: FormData, name: string): string {
  const value = optionalId(form, name)
  if (!value) throw new FormError('Registro inválido.')
  return value
}

export type StoreInput = {
  id: string | null
  slug: string
  name: string
  logoUrl: string | null
  supportWhatsapp: string | null
  supportUrl: string | null
  loginImageUrl: string | null
}

export function parseStoreForm(form: FormData): StoreInput {
  const name = text(form, 'name')
  if (!name) throw new FormError('Informe o nome da loja.')
  const slug = text(form, 'slug') || slugify(name)
  if (!isValidStoreSlug(slug)) {
    throw new FormError('Endereço inválido: use letras minúsculas, números e hífen, sem nomes reservados (admin, api, entrar, sair, icons).')
  }
  const whatsappRaw = text(form, 'support_whatsapp')
  const supportWhatsapp = whatsappRaw ? normalizeWhatsapp(whatsappRaw) : null
  if (whatsappRaw && !supportWhatsapp) throw new FormError('WhatsApp inválido: use DDI + DDD + número, por exemplo 5511999998888.')
  return {
    id: optionalId(form, 'id'),
    slug,
    name,
    logoUrl: optionalUrl(form, 'logo_url', 'Logo'),
    supportWhatsapp,
    supportUrl: optionalUrl(form, 'support_url', 'Link de suporte'),
    loginImageUrl: optionalUrl(form, 'login_image_url', 'Imagem do login'),
  }
}

export type ProductInput = {
  id: string | null
  storeId: string
  slug: string
  title: string
  description: string
  coverUrl: string | null
  bannerUrl: string | null
  checkoutUrl: string | null
  isFeatured: boolean
  sortOrder: number
  isPublished: boolean
}

export function parseProductForm(form: FormData, storeId: string): ProductInput {
  const title = text(form, 'title')
  if (!title) throw new FormError('Informe o título do produto.')
  const slug = text(form, 'slug') || slugify(title)
  if (!isValidSlug(slug)) throw new FormError('Endereço do produto inválido: use letras minúsculas, números e hífen.')
  const sortOrder = Number(text(form, 'sort_order') || 0)
  return {
    id: optionalId(form, 'id'),
    storeId,
    slug,
    title,
    description: text(form, 'description'),
    coverUrl: optionalUrl(form, 'cover_url', 'Capa'),
    bannerUrl: optionalUrl(form, 'banner_url', 'Banner'),
    checkoutUrl: optionalUrl(form, 'checkout_url', 'Checkout'),
    isFeatured: checked(form, 'is_featured'),
    sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
    isPublished: checked(form, 'is_published'),
  }
}

export type ModuleInput = { id: string | null; productId: string; title: string; isPublished: boolean }

export function parseModuleForm(form: FormData): ModuleInput {
  const title = text(form, 'title')
  if (!title) throw new FormError('Informe o nome do módulo.')
  return { id: optionalId(form, 'id'), productId: requiredId(form, 'product_id'), title, isPublished: checked(form, 'is_published') }
}

const KINDS: readonly ItemKind[] = ['arquivo', 'video', 'link']

export type ItemInput = {
  id: string | null
  moduleId: string
  title: string
  kind: ItemKind
  url: string
  coverUrl: string | null
  isPublished: boolean
}

export function parseItemForm(form: FormData): ItemInput {
  const title = text(form, 'title')
  if (!title) throw new FormError('Informe o título do item.')
  const kind = text(form, 'kind') as ItemKind
  if (!KINDS.includes(kind)) throw new FormError('Tipo de item inválido.')
  const url = optionalUrl(form, 'url', 'Link do item')
  if (!url) throw new FormError('Informe o link do item.')
  if (kind === 'video' && !toVideoEmbed(url)) throw new FormError('Vídeo não reconhecido: use um link do YouTube, Vimeo ou Panda.')
  return {
    id: optionalId(form, 'id'),
    moduleId: requiredId(form, 'module_id'),
    title,
    kind,
    url,
    coverUrl: optionalUrl(form, 'cover_url', 'Capa do item'),
    isPublished: checked(form, 'is_published'),
  }
}

export type OfferInput = { id: string | null; storeId: string; name: string; paytProductCode: string; productIds: string[] }

export function parseOfferForm(form: FormData, storeId: string): OfferInput {
  const name = text(form, 'name')
  if (!name) throw new FormError('Informe o nome da oferta.')
  const paytProductCode = text(form, 'payt_product_code')
  if (!paytProductCode || /\s/.test(paytProductCode)) throw new FormError('Informe o código do produto na Payt, sem espaços.')
  const productIds = form.getAll('product_ids').map(String)
  if (!productIds.every(isUuid)) throw new FormError('Produto inválido.')
  return { id: optionalId(form, 'id'), storeId, name, paytProductCode, productIds }
}
```

Run: `npx vitest run tests/admin` → Expected: PASS.

- [ ] **Step 3: Loja do admin, ajudantes e dados**

`src/lib/admin/current-store.ts`:

```ts
import { cookies } from 'next/headers'
import { getDefaultStore, getStoreBySlug } from '@/lib/data/stores'
import type { Store } from '@/lib/domain/types'

export const ADMIN_STORE_COOKIE = 'admin_loja'

export async function getAdminStore(): Promise<Store> {
  const slug = (await cookies()).get(ADMIN_STORE_COOKIE)?.value
  return (slug ? await getStoreBySlug(slug) : null) ?? getDefaultStore()
}
```

`src/lib/admin/action-helpers.ts`:

```ts
export function errorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Não foi possível salvar.'
}

export async function uploadIfPresent(
  value: FormDataEntryValue | null,
  current: string | null,
  upload: (file: File) => Promise<string>,
): Promise<string | null> {
  return value instanceof File && value.size > 0 ? upload(value) : current
}

export function withMessage(path: string, message: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}msg=${encodeURIComponent(message)}`
}
```

Em `src/lib/data/stores.ts`, acrescentar:

```ts
import type { StoreInput } from '@/lib/admin/forms'

export async function listStores(): Promise<Store[]> {
  const { data, error } = await createAdminClient().from('stores').select(STORE_COLUMNS).order('name')
  if (error) throw error
  return (data as DbStore[]).map(toStore)
}

export async function saveStore(input: StoreInput): Promise<string> {
  const row = {
    slug: input.slug,
    name: input.name,
    logo_url: input.logoUrl,
    support_whatsapp: input.supportWhatsapp,
    support_url: input.supportUrl,
    login_image_url: input.loginImageUrl,
  }
  const db = createAdminClient()
  const { data, error } = input.id
    ? await db.from('stores').update(row).eq('id', input.id).select('id').single()
    : await db.from('stores').insert(row).select('id').single()
  if (error) throw error.code === '23505' ? new Error('Já existe uma loja com este endereço.') : error
  return data.id as string
}
```

(O `import type` vai junto dos outros imports no topo do arquivo.)

Criar `src/lib/data/products-admin.ts`:

```ts
import type { ItemInput, ModuleInput, OfferInput, ProductInput } from '@/lib/admin/forms'
import { moveInList } from '@/lib/admin/order'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function friendly(error: { code?: string; message: string }, duplicateMessage: string): Error {
  return new Error(error.code === '23505' ? duplicateMessage : error.message)
}

const now = () => new Date().toISOString()

export async function saveProduct(input: ProductInput): Promise<string> {
  const db = createAdminClient()
  const row = {
    store_id: input.storeId,
    slug: input.slug,
    title: input.title,
    description: input.description,
    cover_url: input.coverUrl,
    banner_url: input.bannerUrl,
    checkout_url: input.checkoutUrl,
    is_featured: input.isFeatured,
    sort_order: input.sortOrder,
    is_published: input.isPublished,
    updated_at: now(),
  }
  const { data, error } = input.id
    ? await db.from('products').update(row).eq('id', input.id).eq('store_id', input.storeId).select('id').single()
    : await db.from('products').insert(row).select('id').single()
  if (error) throw friendly(error, 'Já existe um produto com este endereço nesta loja.')
  return data.id as string
}

async function nextSortOrder(table: 'modules' | 'items', parentColumn: 'product_id' | 'module_id', parentId: string): Promise<number> {
  const { data, error } = await createAdminClient()
    .from(table)
    .select('sort_order')
    .eq(parentColumn, parentId)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (error) throw error
  return data.length ? (data[0].sort_order as number) + 1 : 0
}

async function renumber(table: 'modules' | 'items', ids: string[]): Promise<void> {
  const db = createAdminClient()
  for (const [index, id] of ids.entries()) {
    const { error } = await db.from(table).update({ sort_order: index }).eq('id', id)
    if (error) throw error
  }
}

export async function saveModule(input: ModuleInput): Promise<void> {
  const db = createAdminClient()
  const { error } = input.id
    ? await db.from('modules').update({ title: input.title, is_published: input.isPublished, updated_at: now() }).eq('id', input.id).eq('product_id', input.productId)
    : await db.from('modules').insert({
        product_id: input.productId,
        title: input.title,
        is_published: input.isPublished,
        sort_order: await nextSortOrder('modules', 'product_id', input.productId),
      })
  if (error) throw error
}

export async function deleteModule(id: string, productId: string): Promise<void> {
  const { error } = await createAdminClient().from('modules').delete().eq('id', id).eq('product_id', productId)
  if (error) throw error
}

export async function moveModule(id: string, productId: string, direction: 'up' | 'down'): Promise<void> {
  const { data, error } = await createAdminClient().from('modules').select('id').eq('product_id', productId).order('sort_order').order('created_at')
  if (error) throw error
  await renumber('modules', moveInList(data.map((r) => r.id as string), id, direction))
}

export async function saveItem(input: ItemInput): Promise<void> {
  const db = createAdminClient()
  const row = { title: input.title, kind: input.kind, url: input.url, cover_url: input.coverUrl, is_published: input.isPublished, updated_at: now() }
  const { error } = input.id
    ? await db.from('items').update(row).eq('id', input.id).eq('module_id', input.moduleId)
    : await db.from('items').insert({ ...row, module_id: input.moduleId, sort_order: await nextSortOrder('items', 'module_id', input.moduleId) })
  if (error) throw error
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await createAdminClient().from('items').delete().eq('id', id)
  if (error) throw error
}

export async function moveItem(id: string, moduleId: string, direction: 'up' | 'down'): Promise<void> {
  const { data, error } = await createAdminClient().from('items').select('id').eq('module_id', moduleId).order('sort_order').order('created_at')
  if (error) throw error
  await renumber('items', moveInList(data.map((r) => r.id as string), id, direction))
}

export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES) throw new Error('Envie uma imagem de até 5 MB.')
  const db = createAdminClient()
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await db.storage.from('covers').upload(path, file, { contentType: file.type })
  if (error) throw error
  return db.storage.from('covers').getPublicUrl(path).data.publicUrl
}

export type AdminOffer = { id: string; name: string; paytProductCode: string; productIds: string[] }

type DbOffer = { id: string; name: string; payt_product_code: string; offer_products: { product_id: string }[] }

const OFFER_COLUMNS = 'id, name, payt_product_code, offer_products(product_id)'

function toOffer(row: DbOffer): AdminOffer {
  return { id: row.id, name: row.name, paytProductCode: row.payt_product_code, productIds: row.offer_products.map((p) => p.product_id) }
}

export async function listOffers(storeId: string): Promise<AdminOffer[]> {
  const { data, error } = await createAdminClient().from('offers').select(OFFER_COLUMNS).eq('store_id', storeId).order('name')
  if (error) throw error
  return (data as DbOffer[]).map(toOffer)
}

export async function getOffer(id: string, storeId: string): Promise<AdminOffer | null> {
  const { data, error } = await createAdminClient().from('offers').select(OFFER_COLUMNS).eq('id', id).eq('store_id', storeId).maybeSingle()
  if (error) throw error
  return data ? toOffer(data as DbOffer) : null
}

export async function saveOffer(input: OfferInput): Promise<void> {
  const db = createAdminClient()

  if (input.productIds.length) {
    const { count, error } = await db.from('products').select('id', { count: 'exact', head: true }).eq('store_id', input.storeId).in('id', input.productIds)
    if (error) throw error
    if (count !== input.productIds.length) throw new Error('Há produto de outra loja na oferta.')
  }

  const row = { store_id: input.storeId, name: input.name, payt_product_code: input.paytProductCode }
  let offerId = input.id
  if (offerId) {
    const { error } = await db.from('offers').update(row).eq('id', offerId).eq('store_id', input.storeId)
    if (error) throw friendly(error, 'Este código da Payt já está em outra oferta.')
  } else {
    const { data, error } = await db.from('offers').insert(row).select('id').single()
    if (error) throw friendly(error, 'Este código da Payt já está em outra oferta.')
    offerId = data.id as string
  }

  // Grava os vínculos novos antes de remover os desmarcados: quem já comprou nunca perde acesso no meio.
  if (input.productIds.length) {
    const { error } = await db
      .from('offer_products')
      .upsert(input.productIds.map((productId) => ({ offer_id: offerId, product_id: productId })), { onConflict: 'offer_id,product_id', ignoreDuplicates: true })
    if (error) throw error
  }

  let removal = db.from('offer_products').delete().eq('offer_id', offerId)
  if (input.productIds.length) removal = removal.not('product_id', 'in', `(${input.productIds.join(',')})`)
  const { error: deleteError } = await removal
  if (deleteError) throw deleteError
}
```

Em `src/lib/data/orders.ts`, substituir o bloco de `AdminOrder` até o fim de `listOrders` por:

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
  source: string
}

export type OrderFilter = 'todos' | 'problemas' | 'desconhecidas' | 'teste'

const ORDER_COLUMNS = 'id, created_at, customer_email, payt_product_code, payt_product_name, status, is_test, amount_cents, source'

type DbOrder = {
  id: string
  created_at: string
  customer_email: string
  payt_product_code: string
  payt_product_name: string
  status: string
  is_test: boolean
  amount_cents: number | null
  source: string
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
    source: o.source,
  }
}

export async function listOrders(storeId: string, filter: OrderFilter): Promise<AdminOrder[]> {
  const db = createAdminClient()
  let query = db.from('orders').select(ORDER_COLUMNS).order('created_at', { ascending: false }).limit(200)
  query = filter === 'desconhecidas' ? query.is('store_id', null) : query.eq('store_id', storeId)
  if (filter === 'problemas') query = query.in('status', ['reembolsado', 'chargeback'])
  if (filter === 'teste') query = query.eq('is_test', true)
  const { data, error } = await query
  if (error) throw error
  const orders = (data as DbOrder[]).map(toAdminOrder)
  if (filter !== 'desconhecidas' || orders.length === 0) return orders

  const { data: offers, error: offersError } = await db
    .from('offers')
    .select('payt_product_code')
    .in('payt_product_code', [...new Set(orders.map((o) => o.productCode))])
  if (offersError) throw offersError
  const known = new Set(offers.map((o) => o.payt_product_code as string))
  return orders.filter((o) => !known.has(o.productCode))
}
```

- [ ] **Step 4: Layout do admin com seletor de loja e login do admin no tema**

Criar `src/app/admin/(painel)/loja-actions.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_STORE_COOKIE } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isValidStoreSlug } from '@/lib/content/slug'

export async function trocarLoja(formData: FormData) {
  await requireAdmin()
  const slug = String(formData.get('slug') ?? '')
  if (isValidStoreSlug(slug)) {
    ;(await cookies()).set(ADMIN_STORE_COOKIE, slug, { httpOnly: true, sameSite: 'lax', path: '/admin', maxAge: 60 * 60 * 24 * 365 })
  }
  redirect('/admin/produtos')
}
```

Substituir `src/app/admin/(painel)/layout.tsx`:

```tsx
import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listStores } from '@/lib/data/stores'
import { trocarLoja } from './loja-actions'

export const dynamic = 'force-dynamic'

const links = [
  { href: '/admin/sucesso', label: 'Sucesso' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/ofertas', label: 'Ofertas' },
  { href: '/admin/avisos', label: 'Avisos Payt' },
  { href: '/admin/emails', label: 'E-mails' },
  { href: '/admin/lojas', label: 'Lojas' },
]

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin()
  const [store, stores] = await Promise.all([getAdminStore(), listStores()])

  return (
    <div className="min-h-dvh bg-fundo text-texto">
      <header className="border-b border-borda bg-superficie">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <span className="font-bold">Admin</span>
          <form action={trocarLoja} className="flex items-center gap-2">
            <label htmlFor="admin-loja" className="sr-only">Loja</label>
            <select id="admin-loja" name="slug" defaultValue={store.slug} className={`${ui.input} py-1.5 text-sm`}>
              {stores.map((s) => (
                <option key={s.id} value={s.slug}>{s.name}</option>
              ))}
            </select>
            <button type="submit" className={ui.buttonGhost}>Trocar</button>
          </form>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-texto-suave hover:text-texto">{l.label}</Link>
            ))}
          </nav>
          <form action="/sair?para=admin" method="post" className="ml-auto flex items-center gap-3 text-sm text-texto-suave">
            <span className="hidden sm:inline">{email}</span>
            <button type="submit" className="hover:text-texto">Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
```

Substituir `src/app/admin/entrar/page.tsx`:

```tsx
import { ui } from '@/components/admin/ui'
import { AdminLoginForm } from './form'

export default function AdminEntrarPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-fundo px-4">
      <div className={`${ui.card} w-full max-w-sm p-6 sm:p-8`}>
        <h1 className="mb-6 text-2xl font-bold">Admin</h1>
        <AdminLoginForm />
      </div>
    </main>
  )
}
```

Substituir `src/app/admin/entrar/form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { ui } from '@/components/admin/ui'
import { enviarCodigo, verificarCodigo, type AdminLoginState } from './actions'

const initial: AdminLoginState = { step: 'email', email: '', error: null }

export function AdminLoginForm() {
  const [sent, send, sending] = useActionState(enviarCodigo, initial)
  const [verified, verify, verifying] = useActionState(verificarCodigo, initial)

  if (sent.step === 'code') {
    return (
      <form action={verify} className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">Enviamos um código para {sent.email}.</p>
        <input type="hidden" name="email" value={sent.email} />
        <input name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required className={ui.input} placeholder="Código recebido por e-mail" />
        {verified.error && <p role="alert" className="text-sm text-destaque">{verified.error}</p>}
        <button type="submit" disabled={verifying} className={ui.button}>{verifying ? 'Verificando…' : 'Entrar'}</button>
      </form>
    )
  }

  return (
    <form action={send} className="flex flex-col gap-4">
      <input name="email" type="email" required defaultValue={sent.email} className={ui.input} placeholder="seu@email.com" />
      {sent.error && <p role="alert" className="text-sm text-destaque">{sent.error}</p>}
      <button type="submit" disabled={sending} className={ui.button}>{sending ? 'Enviando…' : 'Enviar código'}</button>
    </form>
  )
}
```

- [ ] **Step 5: Lojas**

Criar `src/app/admin/(painel)/lojas/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { errorText, uploadIfPresent, withMessage } from '@/lib/admin/action-helpers'
import { parseStoreForm } from '@/lib/admin/forms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { uploadImage } from '@/lib/data/products-admin'
import { saveStore } from '@/lib/data/stores'

export async function salvarLoja(formData: FormData) {
  await requireAdmin()
  const currentId = String(formData.get('id') ?? '') || 'nova'
  let storeId: string
  try {
    const input = parseStoreForm(formData)
    input.logoUrl = await uploadIfPresent(formData.get('logo'), input.logoUrl, uploadImage)
    input.loginImageUrl = await uploadIfPresent(formData.get('login_image'), input.loginImageUrl, uploadImage)
    storeId = await saveStore(input)
  } catch (e) {
    redirect(withMessage(`/admin/lojas/${currentId}`, errorText(e)))
  }
  revalidatePath('/admin', 'layout')
  redirect(withMessage(`/admin/lojas/${storeId}`, 'Loja salva.'))
}
```

Criar `src/app/admin/(painel)/lojas/store-form.tsx`:

```tsx
import { ui } from '@/components/admin/ui'
import type { Store } from '@/lib/domain/types'
import { salvarLoja } from './actions'

export function StoreForm({ store }: { store: Store | null }) {
  return (
    <form action={salvarLoja} className={`${ui.card} flex max-w-2xl flex-col gap-4 p-5`}>
      <input type="hidden" name="id" value={store?.id ?? ''} />
      <input type="hidden" name="logo_url" value={store?.logoUrl ?? ''} />
      <input type="hidden" name="login_image_url" value={store?.loginImageUrl ?? ''} />
      <label className={ui.label}>Nome<input name="name" required defaultValue={store?.name} className={ui.input} /></label>
      <label className={ui.label}>
        Endereço (vira seusite.com/endereco; vazio = gerado do nome)
        <input name="slug" defaultValue={store?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={ui.input} />
      </label>
      <label className={ui.label}>
        WhatsApp de suporte (DDI + DDD + número)
        <input name="support_whatsapp" inputMode="tel" defaultValue={store?.supportWhatsapp ?? ''} placeholder="5511999998888" className={ui.input} />
      </label>
      <label className={ui.label}>Link de suporte (opcional)<input name="support_url" type="url" defaultValue={store?.supportUrl ?? ''} className={ui.input} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={ui.label}>
          Logo
          {store?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt="" className="h-12 w-auto rounded bg-fundo p-1" />
          )}
          <input name="logo" type="file" accept="image/*" className="text-sm" />
        </label>
        <label className={ui.label}>
          Imagem do login
          {store?.loginImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.loginImageUrl} alt="" className="aspect-video w-full rounded object-cover" />
          )}
          <input name="login_image" type="file" accept="image/*" className="text-sm" />
        </label>
      </div>
      <button type="submit" className={`${ui.button} self-start`}>Salvar</button>
    </form>
  )
}
```

Criar `src/app/admin/(painel)/lojas/page.tsx`:

```tsx
import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listStores } from '@/lib/data/stores'

export default async function LojasPage({ searchParams }: PageProps<'/admin/lojas'>) {
  await requireAdmin()
  const { msg } = await searchParams
  const stores = await listStores()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className={ui.h1}>Lojas</h1>
        <Link href="/admin/lojas/nova" className={ui.button}>Nova loja</Link>
      </div>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr><th className={ui.th}>Nome</th><th className={ui.th}>Endereço</th><th className={ui.th}>WhatsApp</th></tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {stores.map((s) => (
              <tr key={s.id}>
                <td className={ui.td}><Link href={`/admin/lojas/${s.id}`} className="font-medium hover:text-destaque">{s.name}</Link></td>
                <td className={ui.td}><a href={`/${s.slug}`} target="_blank" rel="noopener noreferrer" className="text-texto-suave hover:text-texto">/{s.slug} ↗</a></td>
                <td className={ui.td}>{s.supportWhatsapp ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

Criar `src/app/admin/(painel)/lojas/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { getStoreById } from '@/lib/data/stores'
import { StoreForm } from '../store-form'

export default async function LojaPage({ params, searchParams }: PageProps<'/admin/lojas/[id]'>) {
  await requireAdmin()
  const [{ id }, { msg }] = await Promise.all([params, searchParams])
  const store = id !== 'nova' && isUuid(id) ? await getStoreById(id) : null
  if (id !== 'nova' && !store) notFound()

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/lojas" className="text-sm text-texto-suave hover:text-texto">← Lojas</Link>
      <h1 className={ui.h1}>{store ? `Editar ${store.name}` : 'Nova loja'}</h1>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      <StoreForm store={store} />
    </div>
  )
}
```

- [ ] **Step 6: Produtos, módulos e itens**

Criar `src/app/admin/(painel)/produtos/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { errorText, uploadIfPresent, withMessage } from '@/lib/admin/action-helpers'
import { getAdminStore } from '@/lib/admin/current-store'
import { parseItemForm, parseModuleForm, parseProductForm } from '@/lib/admin/forms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { getProductById } from '@/lib/data/products'
import { deleteItem, deleteModule, moveItem, moveModule, saveItem, saveModule, saveProduct, uploadImage } from '@/lib/data/products-admin'

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? '')
}

function direction(form: FormData): 'up' | 'down' {
  return field(form, 'direcao') === 'up' ? 'up' : 'down'
}

async function requireOwnProduct(productId: string) {
  await requireAdmin()
  const store = await getAdminStore()
  const product = isUuid(productId) ? await getProductById(productId) : null
  if (!product || product.storeId !== store.id) redirect('/admin/produtos')
  return { store, product }
}

function done(storeSlug: string, productId: string, aba: 'geral' | 'conteudo', message: string): never {
  revalidatePath(`/admin/produtos/${productId}`)
  revalidatePath(`/${storeSlug}`, 'layout')
  redirect(withMessage(`/admin/produtos/${productId}?aba=${aba}`, message))
}

async function attempt(action: () => Promise<unknown>, success: string): Promise<string> {
  try {
    await action()
    return success
  } catch (e) {
    return errorText(e)
  }
}

export async function salvarProduto(formData: FormData) {
  await requireAdmin()
  const store = await getAdminStore()
  const currentId = field(formData, 'id') || 'novo'
  if (currentId !== 'novo') await requireOwnProduct(currentId)

  let productId: string
  try {
    const input = parseProductForm(formData, store.id)
    input.coverUrl = await uploadIfPresent(formData.get('cover'), input.coverUrl, uploadImage)
    input.bannerUrl = await uploadIfPresent(formData.get('banner'), input.bannerUrl, uploadImage)
    productId = await saveProduct(input)
  } catch (e) {
    redirect(withMessage(`/admin/produtos/${currentId}`, errorText(e)))
  }
  revalidatePath('/admin/produtos')
  done(store.slug, productId, 'geral', 'Produto salvo.')
}

export async function salvarModulo(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => saveModule(parseModuleForm(formData)), 'Módulo salvo.')
  done(store.slug, product.id, 'conteudo', message)
}

export async function excluirModulo(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => deleteModule(field(formData, 'id'), product.id), 'Módulo excluído.')
  done(store.slug, product.id, 'conteudo', message)
}

export async function moverModulo(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => moveModule(field(formData, 'id'), product.id, direction(formData)), 'Ordem atualizada.')
  done(store.slug, product.id, 'conteudo', message)
}

export async function salvarItem(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => saveItem(parseItemForm(formData)), 'Item salvo.')
  done(store.slug, product.id, 'conteudo', message)
}

export async function excluirItem(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => deleteItem(field(formData, 'id')), 'Item excluído.')
  done(store.slug, product.id, 'conteudo', message)
}

export async function moverItem(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => moveItem(field(formData, 'id'), field(formData, 'module_id'), direction(formData)), 'Ordem atualizada.')
  done(store.slug, product.id, 'conteudo', message)
}
```

Criar `src/app/admin/(painel)/produtos/product-form.tsx`:

```tsx
import { ui } from '@/components/admin/ui'
import { AutoCover } from '@/components/membros/auto-cover'
import type { Product } from '@/lib/domain/types'
import { salvarProduto } from './actions'

export function ProductForm({ product }: { product: Product | null }) {
  const seed = product?.id ?? 'novo-produto'
  return (
    <form action={salvarProduto} className={`${ui.card} grid gap-6 p-5 lg:grid-cols-[240px_1fr]`}>
      <input type="hidden" name="id" value={product?.id ?? ''} />
      <input type="hidden" name="cover_url" value={product?.coverUrl ?? ''} />
      <input type="hidden" name="banner_url" value={product?.bannerUrl ?? ''} />

      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-sm text-texto-suave">Capa (vertical 2:3)</p>
          <AutoCover seed={seed} title={product?.title ?? 'Novo produto'} imageUrl={product?.coverUrl ?? null} aspect="poster" />
          <input name="cover" type="file" accept="image/*" className="mt-2 text-sm" />
        </div>
        <div>
          <p className="mb-2 text-sm text-texto-suave">Banner (horizontal 16:9)</p>
          <AutoCover seed={seed} title="" imageUrl={product?.bannerUrl ?? null} aspect="banner" />
          <input name="banner" type="file" accept="image/*" className="mt-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <label className={ui.label}>Título<input name="title" required defaultValue={product?.title} className={ui.input} /></label>
        <label className={ui.label}>
          Endereço (vazio = gerado do título)
          <input name="slug" defaultValue={product?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={ui.input} />
        </label>
        <label className={ui.label}>Descrição<textarea name="description" rows={5} defaultValue={product?.description} className={ui.input} /></label>
        <label className={ui.label}>
          Link do checkout (botão &quot;Quero acessar&quot;)
          <input name="checkout_url" type="url" defaultValue={product?.checkoutUrl ?? ''} className={ui.input} />
        </label>
        <label className={ui.label}>Ordem<input name="sort_order" type="number" defaultValue={product?.sortOrder ?? 0} className={ui.input} /></label>
        <label className={ui.checkbox}>
          <input name="is_featured" type="checkbox" defaultChecked={product?.isFeatured ?? false} /> Destaque no topo da vitrine
        </label>
        <label className={ui.checkbox}>
          <input name="is_published" type="checkbox" defaultChecked={product?.isPublished ?? false} /> Publicado
        </label>
        <button type="submit" className={`${ui.button} self-start`}>Salvar</button>
      </div>
    </form>
  )
}
```

Criar `src/app/admin/(painel)/produtos/content-editor.tsx`:

```tsx
import { ui } from '@/components/admin/ui'
import type { Item, ModuleWithItems } from '@/lib/domain/types'
import { excluirItem, excluirModulo, moverItem, moverModulo, salvarItem, salvarModulo } from './actions'

const KIND_LABEL = { arquivo: 'Arquivo', video: 'Vídeo', link: 'Link' } as const

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  )
}

function MoveButtons({
  action,
  hidden,
  first,
  last,
  label,
}: {
  action: (form: FormData) => Promise<void>
  hidden: Record<string, string>
  first: boolean
  last: boolean
  label: string
}) {
  return (
    <form action={action} className="flex gap-1">
      <Hidden values={hidden} />
      <button type="submit" name="direcao" value="up" disabled={first} aria-label={`Subir ${label}`} className={`${ui.buttonGhost} px-2 disabled:opacity-40`}>↑</button>
      <button type="submit" name="direcao" value="down" disabled={last} aria-label={`Descer ${label}`} className={`${ui.buttonGhost} px-2 disabled:opacity-40`}>↓</button>
    </form>
  )
}

function ConfirmDelete({ action, hidden, question }: { action: (form: FormData) => Promise<void>; hidden: Record<string, string>; question: string }) {
  return (
    <details className="relative">
      <summary className={`${ui.buttonDanger} cursor-pointer list-none`}>Excluir</summary>
      <form action={action} className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-borda bg-superficie p-3 text-sm shadow-xl">
        <Hidden values={hidden} />
        <p>{question}</p>
        <button type="submit" className={`${ui.buttonDanger} mt-3 w-full`}>Confirmar exclusão</button>
      </form>
    </details>
  )
}

function ItemFields({ moduleId, productId, item }: { moduleId: string; productId: string; item?: Item }) {
  return (
    <form action={salvarItem} className="grid gap-3 sm:grid-cols-2">
      <Hidden values={{ id: item?.id ?? '', module_id: moduleId, product_id: productId }} />
      <label className={ui.label}>Título<input name="title" required defaultValue={item?.title} className={ui.input} /></label>
      <label className={ui.label}>
        Tipo
        <select name="kind" defaultValue={item?.kind ?? 'arquivo'} className={ui.input}>
          <option value="arquivo">Arquivo (PDF, Drive…)</option>
          <option value="video">Vídeo (YouTube, Vimeo, Panda)</option>
          <option value="link">Link externo</option>
        </select>
      </label>
      <label className={`${ui.label} sm:col-span-2`}>Link<input name="url" type="url" required defaultValue={item?.url} className={ui.input} /></label>
      <label className={`${ui.label} sm:col-span-2`}>
        Capa (opcional, link de imagem)
        <input name="cover_url" type="url" defaultValue={item?.coverUrl ?? ''} className={ui.input} />
      </label>
      <label className={ui.checkbox}>
        <input name="is_published" type="checkbox" defaultChecked={item?.isPublished ?? true} /> Publicado
      </label>
      <button type="submit" className={`${ui.button} justify-self-start`}>{item ? 'Salvar item' : 'Adicionar item'}</button>
    </form>
  )
}

export function ContentEditor({ productId, modules }: { productId: string; modules: ModuleWithItems[] }) {
  return (
    <div className="flex flex-col gap-4">
      {modules.length === 0 && (
        <p className={ui.notice}>Nenhum módulo ainda. Crie o primeiro abaixo — produto com um módulo só não mostra a divisão para o cliente.</p>
      )}

      {modules.map((m, moduleIndex) => (
        <section key={m.id} className={`${ui.card} p-4`}>
          <div className="flex flex-wrap items-end gap-3">
            <form action={salvarModulo} className="flex flex-1 flex-wrap items-end gap-3">
              <Hidden values={{ id: m.id, product_id: productId }} />
              <label className={`${ui.label} min-w-48 flex-1`}>Módulo<input name="title" required defaultValue={m.title} className={ui.input} /></label>
              <label className={ui.checkbox}><input name="is_published" type="checkbox" defaultChecked={m.isPublished} /> Publicado</label>
              <button type="submit" className={ui.buttonGhost}>Salvar</button>
            </form>
            <MoveButtons action={moverModulo} hidden={{ id: m.id, product_id: productId }} first={moduleIndex === 0} last={moduleIndex === modules.length - 1} label={m.title} />
            <ConfirmDelete action={excluirModulo} hidden={{ id: m.id, product_id: productId }} question={`Excluir o módulo e os ${m.items.length} itens dele?`} />
          </div>

          <ul className="mt-4 divide-y divide-borda rounded-md border border-borda">
            {m.items.map((item, itemIndex) => (
              <li key={item.id} className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`${ui.pill} bg-superficie-2 text-texto-suave`}>{KIND_LABEL[item.kind]}</span>
                  <span className={`flex-1 ${item.isPublished ? '' : 'text-texto-suave line-through'}`}>{item.title}</span>
                  <MoveButtons
                    action={moverItem}
                    hidden={{ id: item.id, module_id: m.id, product_id: productId }}
                    first={itemIndex === 0}
                    last={itemIndex === m.items.length - 1}
                    label={item.title}
                  />
                  <ConfirmDelete action={excluirItem} hidden={{ id: item.id, product_id: productId }} question={`Excluir "${item.title}"?`} />
                </div>
                <details>
                  <summary className="cursor-pointer text-sm text-texto-suave hover:text-texto">Editar</summary>
                  <div className="mt-3">
                    <ItemFields moduleId={m.id} productId={productId} item={item} />
                  </div>
                </details>
              </li>
            ))}
            {m.items.length === 0 && <li className="p-3 text-sm text-texto-suave">Nenhum item neste módulo.</li>}
          </ul>

          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-destaque">+ Novo item</summary>
            <div className="mt-3">
              <ItemFields moduleId={m.id} productId={productId} />
            </div>
          </details>
        </section>
      ))}

      <form action={salvarModulo} className={`${ui.card} flex flex-wrap items-end gap-3 p-4`}>
        <Hidden values={{ product_id: productId, is_published: 'on' }} />
        <label className={`${ui.label} min-w-48 flex-1`}>
          Novo módulo
          <input name="title" required placeholder="Ex.: Módulo 1 — Fissuras" className={ui.input} />
        </label>
        <button type="submit" className={ui.button}>Criar módulo</button>
      </form>
    </div>
  )
}
```

Criar `src/app/admin/(painel)/produtos/page.tsx`:

```tsx
import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { AutoCover } from '@/components/membros/auto-cover'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listProducts } from '@/lib/data/products'

export default async function ProdutosPage() {
  await requireAdmin()
  const store = await getAdminStore()
  const products = await listProducts(store.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className={ui.h1}>Produtos — {store.name}</h1>
        <Link href="/admin/produtos/novo" className={ui.button}>Novo produto</Link>
      </div>
      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr>
              <th className={ui.th}>Capa</th><th className={ui.th}>Título</th><th className={ui.th}>Endereço</th>
              <th className={ui.th}>Ordem</th><th className={ui.th}>Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {products.map((p) => (
              <tr key={p.id}>
                <td className={ui.td}><div className="w-10"><AutoCover seed={p.id} title="" imageUrl={p.coverUrl} aspect="poster" /></div></td>
                <td className={ui.td}><Link href={`/admin/produtos/${p.id}`} className="font-medium hover:text-destaque">{p.title}</Link></td>
                <td className={`${ui.td} text-texto-suave`}>/{p.slug}</td>
                <td className={ui.td}>{p.sortOrder}</td>
                <td className={ui.td}>
                  <span className={`${ui.pill} ${p.isPublished ? 'bg-sucesso/15 text-sucesso' : 'bg-superficie-2 text-texto-suave'}`}>{p.isPublished ? 'Publicado' : 'Oculto'}</span>
                  {p.isFeatured && <span className={`${ui.pill} ml-2 bg-destaque/15 text-destaque`}>Destaque</span>}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={5} className={`${ui.td} text-texto-suave`}>Nenhum produto nesta loja.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

Criar `src/app/admin/(painel)/produtos/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { getProductById, listModulesWithItems } from '@/lib/data/products'
import { ContentEditor } from '../content-editor'
import { ProductForm } from '../product-form'

export default async function ProdutoAdminPage({ params, searchParams }: PageProps<'/admin/produtos/[id]'>) {
  await requireAdmin()
  const [{ id }, { aba, msg }] = await Promise.all([params, searchParams])
  const store = await getAdminStore()
  const product = id !== 'novo' && isUuid(id) ? await getProductById(id) : null
  if (id !== 'novo' && (!product || product.storeId !== store.id)) notFound()

  const showContent = Boolean(product) && aba === 'conteudo'
  const modules = product && showContent ? await listModulesWithItems(product.id, { publishedOnly: false }) : []

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/produtos" className="text-sm text-texto-suave hover:text-texto">← Produtos</Link>
      <h1 className={ui.h1}>{product ? product.title : 'Novo produto'}</h1>
      {product && (
        <nav className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/produtos/${product.id}?aba=geral`} className={ui.chip(!showContent)}>Geral</Link>
          <Link href={`/admin/produtos/${product.id}?aba=conteudo`} className={ui.chip(showContent)}>Conteúdo</Link>
          <a href={`/${store.slug}/produto/${product.slug}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm text-texto-suave hover:text-texto">
            Ver na loja ↗
          </a>
        </nav>
      )}
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      {product && showContent ? <ContentEditor productId={product.id} modules={modules} /> : <ProductForm product={product} />}
    </div>
  )
}
```

- [ ] **Step 7: Ofertas**

Substituir `src/app/admin/(painel)/ofertas/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { errorText, withMessage } from '@/lib/admin/action-helpers'
import { getAdminStore } from '@/lib/admin/current-store'
import { parseOfferForm } from '@/lib/admin/forms'
import { requireAdmin } from '@/lib/auth/require-admin'
import { saveOffer } from '@/lib/data/products-admin'

export async function salvarOferta(formData: FormData) {
  await requireAdmin()
  const store = await getAdminStore()
  const currentId = String(formData.get('id') ?? '') || 'novo'
  try {
    await saveOffer(parseOfferForm(formData, store.id))
  } catch (e) {
    redirect(withMessage(`/admin/ofertas/${currentId}`, errorText(e)))
  }
  revalidatePath('/admin/ofertas')
  revalidatePath(`/${store.slug}`, 'layout')
  redirect(withMessage('/admin/ofertas', 'Oferta salva.'))
}
```

Substituir `src/app/admin/(painel)/ofertas/offer-form.tsx`:

```tsx
import { ui } from '@/components/admin/ui'
import type { AdminOffer } from '@/lib/data/products-admin'
import type { Product } from '@/lib/domain/types'
import { salvarOferta } from './actions'

export function OfferForm({ offer, products, initialCode }: { offer: AdminOffer | null; products: Product[]; initialCode: string }) {
  return (
    <form action={salvarOferta} className={`${ui.card} flex max-w-xl flex-col gap-4 p-5`}>
      <input type="hidden" name="id" value={offer?.id ?? ''} />
      <label className={ui.label}>Nome (ex.: Plano Completo)<input name="name" required defaultValue={offer?.name} className={ui.input} /></label>
      <label className={ui.label}>
        Código do produto na Payt
        <input name="payt_product_code" required defaultValue={offer?.paytProductCode ?? initialCode} className={ui.input} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-texto-suave">Produtos liberados</legend>
        {products.map((p) => (
          <label key={p.id} className={ui.checkbox}>
            <input type="checkbox" name="product_ids" value={p.id} defaultChecked={offer?.productIds.includes(p.id)} />
            {p.title}
          </label>
        ))}
        {products.length === 0 && <p className="text-sm text-texto-suave">Cadastre produtos nesta loja primeiro.</p>}
      </fieldset>
      <button type="submit" className={`${ui.button} self-start`}>Salvar</button>
    </form>
  )
}
```

Substituir `src/app/admin/(painel)/ofertas/page.tsx`:

```tsx
import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listProducts } from '@/lib/data/products'
import { listOffers } from '@/lib/data/products-admin'

export default async function OfertasPage({ searchParams }: PageProps<'/admin/ofertas'>) {
  await requireAdmin()
  const { msg } = await searchParams
  const store = await getAdminStore()
  const [offers, products] = await Promise.all([listOffers(store.id), listProducts(store.id)])
  const titles = new Map(products.map((p) => [p.id, p.title]))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className={ui.h1}>Ofertas — {store.name}</h1>
        <Link href="/admin/ofertas/novo" className={ui.button}>Nova oferta</Link>
      </div>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      <ul className={`${ui.card} divide-y divide-borda`}>
        {offers.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/ofertas/${o.id}`} className="block px-4 py-3 hover:bg-superficie-2">
              <span className="font-medium">{o.name}</span> <span className="text-sm text-texto-suave">({o.paytProductCode})</span>
              <span className="block text-sm text-texto-suave">
                {o.productIds.map((id) => titles.get(id)).filter(Boolean).join(' · ') || 'Nenhum produto'}
              </span>
            </Link>
          </li>
        ))}
        {offers.length === 0 && <li className="px-4 py-3 text-texto-suave">Nenhuma oferta cadastrada.</li>}
      </ul>
    </div>
  )
}
```

Substituir `src/app/admin/(painel)/ofertas/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { listProducts } from '@/lib/data/products'
import { getOffer } from '@/lib/data/products-admin'
import { OfferForm } from '../offer-form'

export default async function OfertaPage({ params, searchParams }: PageProps<'/admin/ofertas/[id]'>) {
  await requireAdmin()
  const [{ id }, { codigo, msg }] = await Promise.all([params, searchParams])
  const store = await getAdminStore()
  const [offer, products] = await Promise.all([
    id !== 'novo' && isUuid(id) ? getOffer(id, store.id) : Promise.resolve(null),
    listProducts(store.id),
  ])
  if (id !== 'novo' && !offer) notFound()

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/ofertas" className="text-sm text-texto-suave hover:text-texto">← Ofertas</Link>
      <h1 className={ui.h1}>{offer ? 'Editar oferta' : `Nova oferta — ${store.name}`}</h1>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      <OfferForm offer={offer} products={products} initialCode={typeof codigo === 'string' ? codigo : ''} />
    </div>
  )
}
```

- [ ] **Step 8: Pedidos por loja e reenvio na loja do admin**

Substituir `src/app/admin/(painel)/pedidos/page.tsx`:

```tsx
import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listOrders, type OrderFilter } from '@/lib/data/orders'

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'problemas', label: 'Reembolsos e chargebacks' },
  { value: 'desconhecidas', label: 'Código sem oferta (todas as lojas)' },
  { value: 'teste', label: 'Teste' },
]

const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-superficie-2 text-texto-suave',
  pago: 'bg-sucesso/15 text-sucesso',
  cancelado: 'bg-superficie-2 text-texto-suave',
  reembolsado: 'bg-alerta/15 text-alerta',
  chargeback: 'bg-destaque/15 text-destaque',
}

export default async function PedidosPage({ searchParams }: PageProps<'/admin/pedidos'>) {
  await requireAdmin()
  const { filtro } = await searchParams
  const filter = FILTERS.find((f) => f.value === filtro)?.value ?? 'todos'
  const store = await getAdminStore()
  const orders = await listOrders(store.id, filter)

  return (
    <div className="flex flex-col gap-4">
      <h1 className={ui.h1}>Pedidos — {store.name}</h1>
      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/admin/pedidos?filtro=${f.value}`} className={ui.chip(f.value === filter)}>{f.label}</Link>
        ))}
      </nav>
      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr><th className={ui.th}>Data</th><th className={ui.th}>Cliente</th><th className={ui.th}>Produto</th><th className={ui.th}>Origem</th><th className={ui.th}>Status</th></tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className={`${ui.td} whitespace-nowrap`}>{new Date(o.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                <td className={ui.td}><Link href={`/admin/clientes?q=${encodeURIComponent(o.customerEmail)}`} className="underline">{o.customerEmail}</Link></td>
                <td className={ui.td}>
                  {o.productName || o.productCode} <span className="text-texto-suave">({o.productCode})</span>
                  {filter === 'desconhecidas' && (
                    <Link href={`/admin/ofertas/novo?codigo=${encodeURIComponent(o.productCode)}`} className="ml-2 text-destaque hover:underline">criar oferta</Link>
                  )}
                  {o.isTest && <span className="ml-2 text-xs text-texto-suave">teste</span>}
                </td>
                <td className={ui.td}>{o.source}</td>
                <td className={ui.td}><span className={`${ui.pill} ${STATUS_STYLE[o.status]}`}>{o.status}</span></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className={`${ui.td} text-texto-suave`}>Nenhum pedido.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

Em `src/app/admin/(painel)/clientes/actions.ts`, trocar o import `getDefaultStore` por `import { getAdminStore } from '@/lib/admin/current-store'` e, em `reenviarAcesso`, trocar `const store = await getDefaultStore()` por `const store = await getAdminStore()`.

Remover a tela antiga de materiais:

```bash
git rm -r "src/app/admin/(painel)/materiais"
```

- [ ] **Step 9: Verificar tudo**

Run: `npm test` → Expected: PASS.
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: concluído.

- [ ] **Step 10: Conferir no navegador (se o login do admin já funcionar)**

O login do admin depende do e-mail verificado no Resend. Se ainda não funcionar, registrar "não testado no navegador" no resumo da tarefa e seguir. Se funcionar, com o MCP Playwright: trocar de loja; criar loja `teste-cuspidora`; criar produto com dois módulos e um item de cada tipo; criar oferta `TESTE-CUSPIDORA` ligada ao produto; conferir `/teste-cuspidora` abrindo a tela de login da loja nova.

- [ ] **Step 11: Commit**

```bash
git add -A src/lib/admin src/lib/data/products-admin.ts src/lib/data/stores.ts src/lib/data/orders.ts src/app/admin tests/admin
git commit -m "feat: admin multi-loja com lojas, produtos, módulos, itens e ofertas"
```

---

### Task 10: Admin — avisos da Payt e registro de e-mails

**Executor:** Subagente Claude (frente C). Exige Tasks 2, 3 e 9 em `main`.

**Files:**
- Create: `src/lib/payt/mask.ts`, `src/lib/admin/labels.ts`, `src/lib/data/payt-events.ts`
- Create: `tests/payt/mask.test.ts`, `tests/admin/labels.test.ts`
- Create: `src/app/admin/(painel)/avisos/page.tsx`, `avisos/[id]/page.tsx`
- Create: `src/app/admin/(painel)/emails/page.tsx`, `emails/actions.ts`

**Interfaces:**
- Consumes: Task 2 (`listEmailLog`, `countEmailsUsedToday`, `countUnresolvedFailed`, `EmailLogFilter`, `resendFailedEmails`, `resendEmailLogEntry`); Task 9 (`ui`, `withMessage`); `env.emailDailyLimit`.
- Produces:
  - `@/lib/payt/mask`: `maskPayload(value)`.
  - `@/lib/admin/labels`: `outcomeLabel(outcome)`, `outcomeStyle(outcome)`, `EMAIL_KIND_LABEL`, `EMAIL_STATUS_STYLE`, `formatDateTime(iso)`.
  - `@/lib/data/payt-events`: `type PaytEventFilter`, `PAYT_EVENTS_PAGE_SIZE`, `type PaytEventRow`, `listPaytEvents(filter, page)`, `getPaytEvent(id)`, `listKnownProductCodes(codes)`.

- [ ] **Step 1: Testes**

Criar `tests/payt/mask.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { maskPayload } from '@/lib/payt/mask'

describe('maskPayload', () => {
  it('esconde a chave de integração em qualquer nível sem mexer no resto', () => {
    const payload = { integration_key: 'segredo', status: 'paid', data: { integration_key: 'outro', itens: [{ integration_key: 'x', code: 'A' }] } }
    expect(maskPayload(payload)).toEqual({ integration_key: '••••', status: 'paid', data: { integration_key: '••••', itens: [{ integration_key: '••••', code: 'A' }] } })
    expect(payload.integration_key).toBe('segredo')
  })

  it('aceita valores simples', () => {
    expect(maskPayload('texto')).toBe('texto')
    expect(maskPayload(null)).toBeNull()
  })
})
```

Criar `tests/admin/labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { outcomeLabel, outcomeStyle } from '@/lib/admin/labels'

describe('labels', () => {
  it('traduz resultados novos e antigos', () => {
    expect(outcomeLabel('liberado')).toBe('Liberado')
    expect(outcomeLabel('codigo_desconhecido')).toBe('Código desconhecido')
    expect(outcomeLabel('processed')).toBe('Processado')
    expect(outcomeLabel('algo_novo')).toBe('algo_novo')
    expect(outcomeLabel(null)).toBe('Processando')
  })

  it('usa estilo neutro para resultado sem cor definida', () => {
    expect(outcomeStyle('erro')).toContain('text-destaque')
    expect(outcomeStyle(null)).toContain('text-texto-suave')
  })
})
```

Run: `npx vitest run tests/payt/mask.test.ts tests/admin/labels.test.ts` → Expected: FAIL.

- [ ] **Step 2: Implementar `mask.ts` e `labels.ts`**

`src/lib/payt/mask.ts`:

```ts
const SECRET_KEYS = new Set(['integration_key'])

export function maskPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskPayload)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, SECRET_KEYS.has(key) ? '••••' : maskPayload(v)]))
  }
  return value
}
```

`src/lib/admin/labels.ts`:

```ts
const OUTCOME_LABEL: Record<string, string> = {
  liberado: 'Liberado',
  atualizado: 'Atualizado',
  sem_mudanca: 'Sem mudança',
  codigo_desconhecido: 'Código desconhecido',
  ignorado: 'Ignorado',
  invalido: 'Inválido',
  chave_invalida: 'Chave inválida',
  erro: 'Erro',
  processed: 'Processado',
  unauthorized: 'Chave inválida',
  invalid: 'Inválido',
  ignored: 'Ignorado',
  failed: 'Erro',
}

const OUTCOME_STYLE: Record<string, string> = {
  liberado: 'bg-sucesso/15 text-sucesso',
  atualizado: 'bg-alerta/15 text-alerta',
  codigo_desconhecido: 'bg-alerta/15 text-alerta',
  invalido: 'bg-destaque/15 text-destaque',
  chave_invalida: 'bg-destaque/15 text-destaque',
  erro: 'bg-destaque/15 text-destaque',
  failed: 'bg-destaque/15 text-destaque',
  unauthorized: 'bg-destaque/15 text-destaque',
  invalid: 'bg-destaque/15 text-destaque',
}

export function outcomeLabel(outcome: string | null): string {
  if (!outcome) return 'Processando'
  return OUTCOME_LABEL[outcome] ?? outcome
}

export function outcomeStyle(outcome: string | null): string {
  return (outcome && OUTCOME_STYLE[outcome]) || 'bg-superficie-2 text-texto-suave'
}

export const EMAIL_KIND_LABEL: Record<string, string> = {
  acesso_novo: 'Acesso chegou',
  produto_novo: 'Produto novo',
  reenvio: 'Reenvio',
}

export const EMAIL_STATUS_STYLE: Record<string, string> = {
  enviado: 'bg-sucesso/15 text-sucesso',
  falhou: 'bg-destaque/15 text-destaque',
  pendente: 'bg-alerta/15 text-alerta',
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}
```

Run: `npx vitest run tests/payt/mask.test.ts tests/admin/labels.test.ts` → Expected: PASS.

- [ ] **Step 3: Dados dos avisos**

Criar `src/lib/data/payt-events.ts`:

```ts
import { createAdminClient } from '@/lib/supabase/admin'

export type PaytEventFilter = 'todos' | 'erros' | 'desconhecidos'
export const PAYT_EVENTS_PAGE_SIZE = 50

export type PaytEventRow = {
  id: string
  receivedAt: string
  customerEmail: string | null
  productCodes: string[]
  paytStatus: string | null
  keyValid: boolean | null
  outcome: string | null
  error: string | null
}

type DbEvent = {
  id: string
  received_at: string
  customer_email: string | null
  product_codes: string[] | null
  payt_status: string | null
  key_valid: boolean | null
  outcome: string | null
  error: string | null
}

const COLUMNS = 'id, received_at, customer_email, product_codes, payt_status, key_valid, outcome, error'

function toRow(row: DbEvent): PaytEventRow {
  return {
    id: row.id,
    receivedAt: row.received_at,
    customerEmail: row.customer_email,
    productCodes: row.product_codes ?? [],
    paytStatus: row.payt_status,
    keyValid: row.key_valid,
    outcome: row.outcome,
    error: row.error,
  }
}

export async function listPaytEvents(filter: PaytEventFilter, page: number): Promise<{ rows: PaytEventRow[]; hasMore: boolean }> {
  const from = Math.max(0, page) * PAYT_EVENTS_PAGE_SIZE
  let query = createAdminClient()
    .from('payt_events')
    .select(COLUMNS)
    .order('received_at', { ascending: false })
    .range(from, from + PAYT_EVENTS_PAGE_SIZE)
  if (filter === 'erros') query = query.in('outcome', ['erro', 'invalido', 'chave_invalida', 'failed', 'invalid', 'unauthorized'])
  if (filter === 'desconhecidos') query = query.or('outcome.eq.codigo_desconhecido,error.ilike.*desconhecidos*')
  const { data, error } = await query
  if (error) throw error
  const rows = (data as DbEvent[]).map(toRow)
  return { rows: rows.slice(0, PAYT_EVENTS_PAGE_SIZE), hasMore: rows.length > PAYT_EVENTS_PAGE_SIZE }
}

export async function getPaytEvent(id: string): Promise<(PaytEventRow & { payload: unknown; processedAt: string | null }) | null> {
  const { data, error } = await createAdminClient()
    .from('payt_events')
    .select(`${COLUMNS}, payload, processed_at`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as DbEvent & { payload: unknown; processed_at: string | null }
  return { ...toRow(row), payload: row.payload, processedAt: row.processed_at }
}

export async function listKnownProductCodes(codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set()
  const { data, error } = await createAdminClient().from('offers').select('payt_product_code').in('payt_product_code', codes)
  if (error) throw error
  return new Set(data.map((o) => o.payt_product_code as string))
}
```

- [ ] **Step 4: Telas de avisos**

Criar `src/app/admin/(painel)/avisos/page.tsx`:

```tsx
import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { formatDateTime, outcomeLabel, outcomeStyle } from '@/lib/admin/labels'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listKnownProductCodes, listPaytEvents, type PaytEventFilter } from '@/lib/data/payt-events'

const FILTERS: { value: PaytEventFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'erros', label: 'Com erro' },
  { value: 'desconhecidos', label: 'Código desconhecido' },
]

export const dynamic = 'force-dynamic'

export default async function AvisosPage({ searchParams }: PageProps<'/admin/avisos'>) {
  await requireAdmin()
  const { filtro, pagina } = await searchParams
  const filter = FILTERS.find((f) => f.value === filtro)?.value ?? 'todos'
  const page = Math.max(0, Number(pagina) || 0)
  const { rows, hasMore } = await listPaytEvents(filter, page)
  const known = await listKnownProductCodes([...new Set(rows.flatMap((r) => r.productCodes))])
  const pageHref = (n: number) => `/admin/avisos?filtro=${filter}&pagina=${n}`

  return (
    <div className="flex flex-col gap-4">
      <h1 className={ui.h1}>Avisos da Payt</h1>
      <p className="text-sm text-texto-suave">Todos os avisos recebidos, de todas as lojas. Códigos sem oferta aparecem destacados.</p>
      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/admin/avisos?filtro=${f.value}`} className={ui.chip(f.value === filter)}>{f.label}</Link>
        ))}
      </nav>
      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr>
              <th className={ui.th}>Recebido</th><th className={ui.th}>E-mail</th><th className={ui.th}>Códigos</th>
              <th className={ui.th}>Status Payt</th><th className={ui.th}>Resultado</th><th className={ui.th}>Erro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`${ui.td} whitespace-nowrap`}>
                  <Link href={`/admin/avisos/${r.id}`} className="underline hover:text-destaque">{formatDateTime(r.receivedAt)}</Link>
                </td>
                <td className={ui.td}>{r.customerEmail ?? '—'}</td>
                <td className={ui.td}>
                  <ul className="flex flex-col gap-1">
                    {r.productCodes.map((code) => (
                      <li key={code}>
                        {known.has(code) ? (
                          code
                        ) : (
                          <>
                            <span className="text-alerta">{code}</span>{' '}
                            <Link href={`/admin/ofertas/novo?codigo=${encodeURIComponent(code)}`} className="text-destaque hover:underline">criar oferta</Link>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className={ui.td}>{r.paytStatus ?? '—'}</td>
                <td className={ui.td}><span className={`${ui.pill} ${outcomeStyle(r.outcome)}`}>{outcomeLabel(r.outcome)}</span></td>
                <td className={`${ui.td} max-w-xs truncate text-texto-suave`} title={r.error ?? undefined}>{r.error ?? ''}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className={`${ui.td} text-texto-suave`}>Nenhum aviso.</td></tr>}
          </tbody>
        </table>
      </div>
      <nav className="flex gap-3">
        {page > 0 && <Link href={pageHref(page - 1)} className={ui.buttonGhost}>← Anteriores</Link>}
        {hasMore && <Link href={pageHref(page + 1)} className={ui.buttonGhost}>Mais antigos →</Link>}
      </nav>
    </div>
  )
}
```

Criar `src/app/admin/(painel)/avisos/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { formatDateTime, outcomeLabel, outcomeStyle } from '@/lib/admin/labels'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { getPaytEvent } from '@/lib/data/payt-events'
import { maskPayload } from '@/lib/payt/mask'

export default async function AvisoPage({ params }: PageProps<'/admin/avisos/[id]'>) {
  await requireAdmin()
  const { id } = await params
  const event = isUuid(id) ? await getPaytEvent(id) : null
  if (!event) notFound()

  const details: [string, string][] = [
    ['Recebido', formatDateTime(event.receivedAt)],
    ['Processado', event.processedAt ? formatDateTime(event.processedAt) : '—'],
    ['E-mail', event.customerEmail ?? '—'],
    ['Códigos', event.productCodes.join(', ') || '—'],
    ['Status Payt', event.paytStatus ?? '—'],
    ['Chave válida', event.keyValid === null ? '—' : event.keyValid ? 'Sim' : 'Não'],
    ['Erro', event.error ?? '—'],
  ]

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/avisos" className="text-sm text-texto-suave hover:text-texto">← Avisos</Link>
      <div className="flex items-center gap-3">
        <h1 className={ui.h1}>Aviso da Payt</h1>
        <span className={`${ui.pill} ${outcomeStyle(event.outcome)}`}>{outcomeLabel(event.outcome)}</span>
      </div>
      <dl className={`${ui.card} grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-[160px_1fr]`}>
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-texto-suave">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h2 className="mb-2 font-semibold">Conteúdo recebido (chave escondida)</h2>
        <pre className={`${ui.card} overflow-x-auto p-4 text-xs leading-relaxed`}>{JSON.stringify(maskPayload(event.payload), null, 2)}</pre>
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Tela de e-mails**

Criar `src/app/admin/(painel)/emails/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { withMessage } from '@/lib/admin/action-helpers'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { resendEmailLogEntry, resendFailedEmails } from '@/lib/email/server'

export async function reenviarEmLote() {
  await requireAdmin()
  const s = await resendFailedEmails()
  revalidatePath('/admin/emails')
  redirect(
    withMessage(
      '/admin/emails',
      `Reenvio concluído: ${s.sent} enviados, ${s.failed} falharam, ${s.skipped} sem produtos liberados, ${s.remaining} ficam para depois.`,
    ),
  )
}

export async function reenviarEmail(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const result = isUuid(id) ? await resendEmailLogEntry(id) : { ok: false as const, error: 'Registro inválido.' }
  revalidatePath('/admin/emails')
  redirect(withMessage('/admin/emails?filtro=falhou', result.ok ? 'E-mail reenviado.' : `Falha ao reenviar: ${result.error}`))
}
```

Criar `src/app/admin/(painel)/emails/page.tsx`:

```tsx
import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { EMAIL_KIND_LABEL, EMAIL_STATUS_STYLE, formatDateTime } from '@/lib/admin/labels'
import { requireAdmin } from '@/lib/auth/require-admin'
import { countEmailsUsedToday, countUnresolvedFailed, listEmailLog, type EmailLogFilter } from '@/lib/data/email-log'
import { env } from '@/lib/env'
import { reenviarEmail, reenviarEmLote } from './actions'

const FILTERS: { value: EmailLogFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'falhou', label: 'Falharam' },
  { value: 'enviado', label: 'Enviados' },
  { value: 'pendente', label: 'Pendentes' },
]

export const dynamic = 'force-dynamic'

export default async function EmailsPage({ searchParams }: PageProps<'/admin/emails'>) {
  await requireAdmin()
  const { filtro, pagina, msg } = await searchParams
  const filter = FILTERS.find((f) => f.value === filtro)?.value ?? 'todos'
  const page = Math.max(0, Number(pagina) || 0)
  const [{ entries, hasMore }, usedToday, failedCount] = await Promise.all([
    listEmailLog(filter, page),
    countEmailsUsedToday(),
    countUnresolvedFailed(),
  ])
  const limit = env.emailDailyLimit
  const pageHref = (n: number) => `/admin/emails?filtro=${filter}&pagina=${n}`

  return (
    <div className="flex flex-col gap-4">
      <h1 className={ui.h1}>E-mails</h1>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}

      <section className={`${ui.card} flex flex-wrap items-center gap-6 p-4`}>
        <div>
          <p className="text-2xl font-bold">{failedCount}</p>
          <p className="text-sm text-texto-suave">com falha aguardando reenvio</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{usedToday} / {limit}</p>
          <p className="text-sm text-texto-suave">usados hoje (limite do plano)</p>
        </div>
        <form action={reenviarEmLote} className="ml-auto">
          <button type="submit" className={ui.button} disabled={failedCount === 0 || usedToday >= limit}>Reenviar em lote</button>
        </form>
      </section>
      <p className="text-sm text-texto-suave">
        O reenvio manda um e-mail por cliente com a lista atual de produtos liberados. Use depois que o domínio de envio estiver verificado.
      </p>

      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/admin/emails?filtro=${f.value}`} className={ui.chip(f.value === filter)}>{f.label}</Link>
        ))}
      </nav>

      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr>
              <th className={ui.th}>Data</th><th className={ui.th}>Loja</th><th className={ui.th}>E-mail</th>
              <th className={ui.th}>Tipo</th><th className={ui.th}>Status</th><th className={ui.th}>Erro</th><th className={ui.th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className={`${ui.td} whitespace-nowrap`}>{formatDateTime(e.createdAt)}</td>
                <td className={ui.td}>{e.storeName ?? '—'}</td>
                <td className={ui.td}>
                  {e.customerId ? <Link href={`/admin/clientes/${e.customerId}`} className="underline">{e.toEmail}</Link> : e.toEmail}
                </td>
                <td className={ui.td}>{EMAIL_KIND_LABEL[e.kind] ?? e.kind}</td>
                <td className={ui.td}>
                  <span className={`${ui.pill} ${EMAIL_STATUS_STYLE[e.status]}`}>{e.status}</span>
                  {e.resolved && <span className="ml-2 text-xs text-texto-suave">reenviado</span>}
                </td>
                <td className={`${ui.td} max-w-xs truncate text-texto-suave`} title={e.error ?? undefined}>{e.error ?? ''}</td>
                <td className={ui.td}>
                  {e.status === 'falhou' && !e.resolved && (
                    <form action={reenviarEmail}>
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" className={ui.buttonGhost}>Reenviar</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={7} className={`${ui.td} text-texto-suave`}>Nenhum e-mail.</td></tr>}
          </tbody>
        </table>
      </div>

      <nav className="flex gap-3">
        {page > 0 && <Link href={pageHref(page - 1)} className={ui.buttonGhost}>← Anteriores</Link>}
        {hasMore && <Link href={pageHref(page + 1)} className={ui.buttonGhost}>Mais antigos →</Link>}
      </nav>
    </div>
  )
}
```

- [ ] **Step 6: Verificar tudo**

Run: `npm test` → Expected: PASS.
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: concluído.

- [ ] **Step 7: Commit**

```bash
git add src/lib/payt/mask.ts src/lib/admin/labels.ts src/lib/data/payt-events.ts "src/app/admin/(painel)/avisos" "src/app/admin/(painel)/emails" tests/payt/mask.test.ts tests/admin/labels.test.ts
git commit -m "feat: telas de avisos da Payt e de e-mails com reenvio em lote"
```

---

### Task 11: Admin — sucesso do cliente e ficha com linha do tempo

**Executor:** Subagente Claude (frente C). Exige Tasks 4, 6 e 10 em `main`.

**Files:**
- Create: `src/lib/success/period.ts`, `tests/success/period.test.ts`
- Create: `src/app/admin/(painel)/sucesso/page.tsx`
- Modify: `src/lib/admin/labels.ts` (acrescentar rótulos de situação)
- Modify: `src/app/admin/(painel)/page.tsx`, `src/app/admin/(painel)/clientes/page.tsx`, `src/app/admin/(painel)/clientes/[id]/page.tsx` (arquivos inteiros)

**Interfaces:**
- Consumes: Task 4 (`classifyCustomer`, `summarizeSuccess`, `buildTimeline`, `loadSuccessRows`, `countFailedEmailsSince`, `listEmailsForCustomer`, `listItemOpensForCustomer`); Task 9 (`getAdminStore`, `ui`); Task 10 (`formatDateTime`); `listOrdersByEmail`, `listDevices`, `getCustomer`, `searchCustomers`, `SHARING_DEVICE_THRESHOLD`.
- Produces: `@/lib/success/period`: `periodWindow(days, now?)`, `parsePeriod(value)`; `SUCCESS_STATUS_LABEL`, `SUCCESS_STATUS_STYLE` em `@/lib/admin/labels`.

- [ ] **Step 1: Teste e implementação do período**

Criar `tests/success/period.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parsePeriod, periodWindow } from '@/lib/success/period'

describe('period', () => {
  it('aceita 7, 30 e 90 dias e usa 30 como padrão', () => {
    expect(parsePeriod('7')).toBe(7)
    expect(parsePeriod('90')).toBe(90)
    expect(parsePeriod('15')).toBe(30)
    expect(parsePeriod(undefined)).toBe(30)
  })

  it('calcula o início da janela', () => {
    const now = new Date('2026-09-17T12:00:00Z')
    expect(periodWindow(7, now)).toEqual({ now, sinceIso: '2026-09-10T12:00:00.000Z' })
  })
})
```

Criar `src/lib/success/period.ts`:

```ts
const PERIODS = [7, 30, 90] as const

export function parsePeriod(value: unknown): number {
  const n = Number(value)
  return (PERIODS as readonly number[]).includes(n) ? n : 30
}

export function periodWindow(days: number, now: Date = new Date()): { now: Date; sinceIso: string } {
  return { now, sinceIso: new Date(now.getTime() - days * 86_400_000).toISOString() }
}
```

Run: `npx vitest run tests/success/period.test.ts` → Expected: PASS.

Acrescentar ao final de `src/lib/admin/labels.ts`:

```ts
export const SUCCESS_STATUS_LABEL: Record<string, string> = {
  nunca_entrou: 'Nunca entrou',
  nao_abriu: 'Entrou e não abriu nada',
  ativo: 'Ativo',
  inativo: 'Inativo',
}

export const SUCCESS_STATUS_STYLE: Record<string, string> = {
  nunca_entrou: 'bg-destaque/15 text-destaque',
  nao_abriu: 'bg-alerta/15 text-alerta',
  ativo: 'bg-sucesso/15 text-sucesso',
  inativo: 'bg-superficie-2 text-texto-suave',
}
```

- [ ] **Step 2: Tela de sucesso do cliente**

Criar `src/app/admin/(painel)/sucesso/page.tsx`:

```tsx
import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { formatDateTime, SUCCESS_STATUS_LABEL, SUCCESS_STATUS_STYLE } from '@/lib/admin/labels'
import { requireAdmin } from '@/lib/auth/require-admin'
import { countFailedEmailsSince, loadSuccessRows } from '@/lib/data/success'
import { classifyCustomer, summarizeSuccess, type SuccessStatus } from '@/lib/success/classify'
import { parsePeriod, periodWindow } from '@/lib/success/period'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const STATUS_FILTERS: ('todos' | SuccessStatus)[] = ['todos', 'nunca_entrou', 'nao_abriu', 'ativo', 'inativo']

export default async function SucessoPage({ searchParams }: PageProps<'/admin/sucesso'>) {
  await requireAdmin()
  const { periodo, filtro, q, pagina } = await searchParams
  const days = parsePeriod(periodo)
  const status = STATUS_FILTERS.find((s) => s === filtro) ?? 'todos'
  const query = typeof q === 'string' ? q.trim().toLowerCase() : ''
  const page = Math.max(0, Number(pagina) || 0)

  const store = await getAdminStore()
  const { now, sinceIso } = periodWindow(days)
  const [rows, failedEmails] = await Promise.all([loadSuccessRows(store.id), countFailedEmailsSince(store.id, sinceIso)])
  const overview = summarizeSuccess(rows, now, days)

  const filtered = rows
    .map((r) => ({ ...r, status: classifyCustomer(r, now) }))
    .filter((r) => status === 'todos' || r.status === status)
    .filter((r) => !query || r.email.includes(query))
    .sort((a, b) => Date.parse(b.firstPaidAt) - Date.parse(a.firstPaidAt))
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const href = (changes: Record<string, string | number>) => {
    const params = new URLSearchParams({ periodo: String(days), filtro: status, q: query, pagina: '0' })
    for (const [key, value] of Object.entries(changes)) params.set(key, String(value))
    return `/admin/sucesso?${params.toString()}`
  }

  const cards = [
    { label: `Compradores (${days} dias)`, value: String(overview.buyers) },
    { label: 'Entraram na área', value: `${overview.loggedInPct}%` },
    { label: 'Abriram algum item', value: `${overview.openedPct}%` },
    { label: 'E-mails com falha no período', value: String(failedEmails) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={ui.h1}>Sucesso do cliente — {store.name}</h1>
        <nav className="ml-auto flex gap-2">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={href({ periodo: d })} className={ui.chip(d === days)}>{d} dias</Link>
          ))}
        </nav>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`${ui.card} p-4`}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-sm text-texto-suave">{c.label}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => (
          <Link key={s} href={href({ filtro: s })} className={ui.chip(s === status)}>
            {s === 'todos' ? 'Todos' : SUCCESS_STATUS_LABEL[s]}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/sucesso">
          <input type="hidden" name="periodo" value={days} />
          <input type="hidden" name="filtro" value={status} />
          <input name="q" defaultValue={query} placeholder="Buscar por e-mail" className={`${ui.input} py-1.5 text-sm`} />
          <button type="submit" className={ui.buttonGhost}>Buscar</button>
        </form>
      </div>

      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr>
              <th className={ui.th}>E-mail</th><th className={ui.th}>Primeira compra</th><th className={ui.th}>Pedidos pagos</th>
              <th className={ui.th}>Último acesso</th><th className={ui.th}>Itens abertos</th><th className={ui.th}>Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {visible.map((r) => (
              <tr key={r.customerId}>
                <td className={ui.td}><Link href={`/admin/clientes/${r.customerId}`} className="underline hover:text-destaque">{r.email}</Link></td>
                <td className={`${ui.td} whitespace-nowrap`}>{formatDateTime(r.firstPaidAt)}</td>
                <td className={ui.td}>{r.paidOrders}</td>
                <td className={`${ui.td} whitespace-nowrap`}>{r.lastSeenAt ? formatDateTime(r.lastSeenAt) : 'nunca'}</td>
                <td className={ui.td}>{r.itemOpens}</td>
                <td className={ui.td}><span className={`${ui.pill} ${SUCCESS_STATUS_STYLE[r.status]}`}>{SUCCESS_STATUS_LABEL[r.status]}</span></td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={6} className={`${ui.td} text-texto-suave`}>Nenhum cliente neste filtro.</td></tr>}
          </tbody>
        </table>
      </div>

      <nav className="flex gap-3">
        {page > 0 && <Link href={href({ pagina: page - 1 })} className={ui.buttonGhost}>← Anterior</Link>}
        {(page + 1) * PAGE_SIZE < filtered.length && <Link href={href({ pagina: page + 1 })} className={ui.buttonGhost}>Próxima →</Link>}
      </nav>
    </div>
  )
}
```

Substituir `src/app/admin/(painel)/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function AdminHome() {
  redirect('/admin/sucesso')
}
```

- [ ] **Step 3: Lista e ficha do cliente no tema, com linha do tempo**

Substituir `src/app/admin/(painel)/clientes/page.tsx`:

```tsx
import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { SHARING_DEVICE_THRESHOLD, searchCustomers } from '@/lib/data/customers'

export default async function ClientesPage({ searchParams }: PageProps<'/admin/clientes'>) {
  await requireAdmin()
  const { q } = await searchParams
  const query = typeof q === 'string' ? q.trim().toLowerCase() : ''
  const customers = await searchCustomers(query)

  return (
    <div className="flex flex-col gap-4">
      <h1 className={ui.h1}>Clientes</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={query} placeholder="Buscar por e-mail" className={`${ui.input} w-full max-w-sm`} />
        <button type="submit" className={ui.button}>Buscar</button>
      </form>
      <ul className={`${ui.card} divide-y divide-borda`}>
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/clientes/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-superficie-2">
              <span>{c.email} <span className="text-sm text-texto-suave">{c.name}</span></span>
              <span className="flex gap-2">
                {c.recentDevices >= SHARING_DEVICE_THRESHOLD && <span className={`${ui.pill} bg-alerta/15 text-alerta`}>{c.recentDevices} aparelhos</span>}
                {c.blockedAt && <span className={`${ui.pill} bg-destaque/15 text-destaque`}>bloqueado</span>}
              </span>
            </Link>
          </li>
        ))}
        {customers.length === 0 && <li className="px-4 py-3 text-texto-suave">Nenhum cliente encontrado.</li>}
      </ul>
    </div>
  )
}
```

Substituir `src/app/admin/(painel)/clientes/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { formatDateTime } from '@/lib/admin/labels'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { getCustomer, listDevices } from '@/lib/data/customers'
import { listOrdersByEmail } from '@/lib/data/orders'
import { listEmailsForCustomer, listItemOpensForCustomer } from '@/lib/data/success'
import { buildTimeline } from '@/lib/success/timeline'
import { alternarBloqueio, corrigirEmail, reenviarAcesso } from '../actions'

const KIND_STYLE: Record<string, string> = {
  pedido: 'bg-sucesso/15 text-sucesso',
  email: 'bg-alerta/15 text-alerta',
  acesso: 'bg-superficie-2 text-texto',
  item: 'bg-destaque/15 text-destaque',
}

export default async function ClientePage({ params, searchParams }: PageProps<'/admin/clientes/[id]'>) {
  await requireAdmin()
  const [{ id }, { msg }] = await Promise.all([params, searchParams])
  if (!isUuid(id)) notFound()
  const customer = await getCustomer(id)
  if (!customer) notFound()

  const [orders, devices, emails, itemOpens] = await Promise.all([
    listOrdersByEmail(customer.email),
    listDevices(id),
    listEmailsForCustomer(id),
    listItemOpensForCustomer(id),
  ])
  const timeline = buildTimeline({ orders, emails, devices, itemOpens })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className={ui.h1}>{customer.email}</h1>
        <p className="text-texto-suave">{customer.name}</p>
        {typeof msg === 'string' && <p role="status" className={`${ui.notice} mt-2`}>{msg}</p>}
      </div>

      <section className="flex flex-wrap gap-2">
        <form action={reenviarAcesso}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={ui.button}>Reenviar acesso</button>
        </form>
        <form action={alternarBloqueio}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="block" value={customer.blockedAt ? 'false' : 'true'} />
          <button type="submit" className={customer.blockedAt ? ui.buttonGhost : ui.buttonDanger}>{customer.blockedAt ? 'Desbloquear' : 'Bloquear'}</button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Corrigir e-mail</h2>
        <form action={corrigirEmail} className="flex flex-wrap gap-2">
          <input type="hidden" name="id" value={id} />
          <input name="email" type="email" required defaultValue={customer.email} className={`${ui.input} w-full max-w-sm`} />
          <button type="submit" className={ui.buttonGhost}>Salvar e-mail</button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Linha do tempo</h2>
        <ol className={`${ui.card} divide-y divide-borda`}>
          {timeline.map((event, index) => (
            <li key={`${event.at}-${index}`} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
              <span className="w-40 shrink-0 text-texto-suave">{formatDateTime(event.at)}</span>
              <span className={`${ui.pill} ${KIND_STYLE[event.kind]}`}>{event.kind}</span>
              <span className="flex-1">{event.title}</span>
              {event.detail && <span className="text-texto-suave">{event.detail}</span>}
            </li>
          ))}
          {timeline.length === 0 && <li className="px-4 py-2 text-sm text-texto-suave">Sem eventos registrados.</li>}
        </ol>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Aparelhos ({devices.length})</h2>
        <ul className={`${ui.card} divide-y divide-borda text-sm`}>
          {devices.map((d) => (
            <li key={`${d.userAgent}-${d.firstSeenAt}`} className="px-4 py-2">
              <span className="block truncate">{d.userAgent || 'Desconhecido'}</span>
              <span className="text-texto-suave">Último acesso: {formatDateTime(d.lastSeenAt)}</span>
            </li>
          ))}
          {devices.length === 0 && <li className="px-4 py-2 text-texto-suave">Nenhum acesso registrado.</li>}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Verificar tudo**

Run: `npm test` → Expected: PASS.
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: concluído.

- [ ] **Step 5: Commit**

```bash
git add src/lib/success/period.ts src/lib/admin/labels.ts "src/app/admin/(painel)/sucesso" "src/app/admin/(painel)/page.tsx" "src/app/admin/(painel)/clientes" tests/success/period.test.ts
git commit -m "feat: sucesso do cliente por loja e linha do tempo na ficha"
```

---

### Task 12: Limpeza, revisão integrada e publicação

**Executor:** Claude (sessão principal). Exige Tasks 1–11 em `main`.

**Files:**
- Create: `supabase/migrations/20260917000002_cuspidora_limpeza.sql`
- Modify: `src/lib/domain/types.ts` (remover `Material`, `OfferLink`, `Store.primaryColor`)
- Modify: `src/lib/access/access.ts` (remover `grantedMaterialIds`, `buildVitrine`, `VitrineItem`)
- Modify: `src/lib/data/access.ts` (remover `loadCustomerAccess`), `src/lib/data/stores.ts` (remover `primary_color`), `src/lib/data/orders.ts` (remover `listOrderRefsByEmail`)
- Delete: `src/lib/data/catalog.ts`, `tests/access/access.test.ts`
- Modify: `docs/status-deploy-2026-09-16.md` (seção nova com o estado da cuspidora)

**Interfaces:**
- Consumes: tudo das tarefas anteriores.
- Produces: banco sem tabelas legadas; app publicado.

- [ ] **Step 1: Remover código legado**

```bash
git rm src/lib/data/catalog.ts tests/access/access.test.ts
```

- Em `src/lib/domain/types.ts`: apagar os tipos `Material` e `OfferLink` e o campo `primaryColor` de `Store`.
- Em `src/lib/access/access.ts`: apagar `VitrineItem`, `grantedMaterialIds` e `buildVitrine`; deixar o import como `import type { OrderRef, Product, ProductLink } from '@/lib/domain/types'`.
- Em `src/lib/data/access.ts`: apagar `loadCustomerAccess` e os imports que ficarem sem uso.
- Em `src/lib/data/orders.ts`: apagar `listOrderRefsByEmail`.
- Em `src/lib/data/stores.ts`: tirar `primary_color` de `STORE_COLUMNS`, de `DbStore` e de `toStore`.

Run: `git grep -n "Material\|materials\|offer_materials\|primaryColor\|primary_color\|OfferLink\|loadCustomerAccess\|listOrderRefsByEmail\|buildVitrine" -- src tests`
Expected: nenhuma ocorrência.

- [ ] **Step 2: Migração de limpeza**

Criar `supabase/migrations/20260917000002_cuspidora_limpeza.sql`:

```sql
drop table public.offer_materials;
drop table public.materials;
alter table public.stores drop column primary_color;

update public.payt_events
   set outcome = case outcome
     when 'processed' then 'sem_mudanca'
     when 'unauthorized' then 'chave_invalida'
     when 'invalid' then 'invalido'
     when 'ignored' then 'ignorado'
     when 'failed' then 'erro'
     else outcome
   end
 where outcome in ('processed', 'unauthorized', 'invalid', 'ignored', 'failed');
```

- [ ] **Step 3: Verificar o código antes de mexer no banco**

Run: `npm test` → Expected: PASS.
Run: `npm run lint` → Expected: sem erros.
Run: `npm run build` → Expected: concluído.

- [ ] **Step 4: Aplicar a limpeza no Supabase**

MCP `apply_migration` com `name: "cuspidora_limpeza"` e o SQL do Step 2. Depois `get_advisors` (`security` e `performance`) e registrar os alertas relevantes no resumo.

- [ ] **Step 5: Revisão integrada no navegador**

Run: `npm run dev`. Com o MCP Playwright, em 375px e 1440px, com o cliente de teste `grupoelevamax@gmail.com`:
1. `/` → `/arquitetura` → login novo → vitrine com destaque e fileiras.
2. Produto bloqueado abre janela de compra; `?comprar=<slug>` abre a janela direto.
3. Produto liberado → item arquivo abre nova aba; conferir no Supabase (`execute_sql`: `select count(*) from item_access`) que o acesso foi registrado e que a fileira "Continuar" aparece.
4. `POST /api/webhooks/payt` local com `tests/fixtures/payt-paid-bumps.json`, trocando `integration_key` pela chave do `.env.local` (sem imprimir a chave) e os códigos por `TESTE-ATLAS` → `payt_events` com `outcome` preenchido e `email_log` com linha `falhou` (domínio ainda não verificado) ou `enviado`.
5. Admin: só se o login por código funcionar; senão registrar como pendência.

- [ ] **Step 6: Variáveis na Vercel e publicação**

Pedir ao usuário para cadastrar na Vercel (projeto `area-de-membros-`, ambientes Production e Preview): `LOGIN_GUARD_SECRET` (valor novo, gerado como no Step 14 da Task 1), `EMAIL_DAILY_LIMIT=100`. Opcional: `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY`.

Depois da confirmação do usuário: `git push origin main` e conferir o deploy com o MCP Vercel (`list_deployments`, `get_deployment_build_logs` se falhar). Em produção: `/` redireciona para `/arquitetura/entrar` e `POST /api/webhooks/payt` com chave errada responde 401.

- [ ] **Step 7: Atualizar o status e commitar**

Acrescentar ao final de `docs/status-deploy-2026-09-16.md` uma seção `## Cuspidora — <data>` com: commit publicado, migrações aplicadas, o que foi verificado no navegador, pendências (verificação do Resend, teste do admin no navegador, aviso real da Payt com bump, links reais dos produtos, remoção dos dados de exemplo).

```bash
git add -A src tests supabase/migrations/20260917000002_cuspidora_limpeza.sql docs/status-deploy-2026-09-16.md
git commit -m "chore: remove materiais legados e registra publicação da cuspidora"
```
