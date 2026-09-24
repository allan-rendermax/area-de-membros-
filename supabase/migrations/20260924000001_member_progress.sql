create table public.member_progress (
  customer_id uuid not null references public.customers(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (customer_id, store_id, item_id)
);

create index member_progress_product_idx on public.member_progress(customer_id, store_id, product_id);

alter table public.member_progress enable row level security;
