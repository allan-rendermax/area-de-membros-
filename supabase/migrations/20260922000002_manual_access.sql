alter table public.orders add column note text not null default '';
alter table public.orders add column created_by text not null default '';
