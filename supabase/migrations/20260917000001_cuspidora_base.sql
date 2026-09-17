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
