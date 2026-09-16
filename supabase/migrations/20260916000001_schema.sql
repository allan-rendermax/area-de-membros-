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
