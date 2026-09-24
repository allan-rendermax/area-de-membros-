alter table public.products add column if not exists role text;
alter table public.products alter column role set default 'front';
update public.products set role = 'front' where role is null;
alter table public.products alter column role set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_role_check'
  ) then
    alter table public.products add constraint products_role_check
      check (role in ('front', 'orderbump', 'upsell'));
  end if;
end $$;
