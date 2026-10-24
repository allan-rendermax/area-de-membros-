alter table public.products
  add column catalog_visibility text not null default 'catalog' check (catalog_visibility in ('catalog','contextual')),
  add column editorial_revision bigint not null default 0;
alter table public.stores
  add column member_library_mode text not null default 'legacy' check (member_library_mode in ('legacy','grouped'));

create table public.product_complements (
  store_id uuid not null references public.stores(id) on delete cascade,
  parent_product_id uuid not null,
  complement_product_id uuid not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key(store_id,parent_product_id,complement_product_id),
  foreign key(store_id,parent_product_id) references public.products(store_id,id) on delete cascade,
  foreign key(store_id,complement_product_id) references public.products(store_id,id) on delete cascade,
  check(parent_product_id <> complement_product_id)
);
create index product_complements_target on public.product_complements(store_id,complement_product_id);
alter table public.product_complements enable row level security;
revoke all on public.product_complements from anon, authenticated;
grant select, insert, update, delete on public.product_complements to service_role;

create function public.advance_product_editorial_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.editorial_revision := old.editorial_revision + 1;
  return new;
end $$;
create trigger product_editorial_revision before update on public.products
for each row execute function public.advance_product_editorial_revision();

create function public.guard_contextual_relation() returns trigger
language plpgsql set search_path = '' as $$
declare v_store uuid;
begin
  if tg_op = 'UPDATE' and (new.store_id <> old.store_id or new.parent_product_id <> old.parent_product_id or new.complement_product_id <> old.complement_product_id) then
    raise exception 'Remova a relação antes de alterar seus produtos.';
  end if;
  v_store := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
  perform id from public.stores where id = v_store for update;
  if tg_op <> 'DELETE' and (
    exists(select 1 from public.product_complements where store_id=new.store_id and complement_product_id=new.parent_product_id)
    or exists(select 1 from public.product_complements where store_id=new.store_id and parent_product_id=new.complement_product_id)
  ) then raise exception 'Um complemento não pode ser principal de outro complemento.'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger contextual_relation_guard before insert or update or delete on public.product_complements
for each row execute function public.guard_contextual_relation();

create function public.touch_contextual_parent() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.products set updated_at=now()
  where id=case when tg_op='DELETE' then old.parent_product_id else new.parent_product_id end;
  return null;
end $$;
create trigger contextual_parent_revision after insert or update or delete on public.product_complements
for each row execute function public.touch_contextual_parent();
