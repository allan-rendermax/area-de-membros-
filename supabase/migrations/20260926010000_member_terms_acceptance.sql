create table public.member_terms_acceptance (
  customer_id uuid not null references public.customers(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  terms_version text not null check (length(terms_version) > 0),
  primary key (customer_id, store_id)
);

alter table public.member_terms_acceptance enable row level security;
revoke all on public.member_terms_acceptance from anon, authenticated;
grant select, insert on public.member_terms_acceptance to service_role;

comment on table public.member_terms_acceptance is
  'Primeiro aceite por aluno e loja. Não expira nem é solicitado novamente ao mudar a versão dos termos.';
