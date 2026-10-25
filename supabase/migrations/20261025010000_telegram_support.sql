-- Private operational state. Only the server's service_role can use it.
create table public.telegram_support_updates (
  update_id bigint primary key check (update_id >= 0),
  created_at timestamptz not null default now()
);
create table public.telegram_support_actions (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null check (user_id > 0),
  chat_id bigint not null check (chat_id > 0),
  customer_id uuid not null references public.customers(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('resend', 'correct')),
  expected_email text not null check (length(expected_email) between 3 and 254),
  new_email text check (length(new_email) between 3 and 254),
  state text not null default 'ready' check (state in ('ready','awaiting_email','confirm','processing','done','uncertain','cancelled')),
  prompt_id bigint,
  log_id uuid,
  result text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes'
);
create index telegram_support_reply on public.telegram_support_actions(user_id,chat_id,prompt_id)
  where state = 'awaiting_email';
-- Keep uncertain actions locked until the actual outcome is reconciled.
create unique index telegram_support_customer_lock on public.telegram_support_actions(customer_id)
  where state in ('processing','uncertain');
alter table public.telegram_support_updates enable row level security;
alter table public.telegram_support_actions enable row level security;
revoke all on public.telegram_support_updates, public.telegram_support_actions from public, anon, authenticated;
grant select,insert,update,delete on public.telegram_support_updates, public.telegram_support_actions to service_role;
