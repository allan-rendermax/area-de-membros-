alter table public.products add column role text not null default 'front'
  check (role in ('front', 'orderbump', 'upsell'));
