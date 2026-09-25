-- Offers keep their stable IDs/codes as plans. Existing purchase lookups stay intact.
create table public.offer_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (id, store_id)
);
alter table public.offer_groups enable row level security;
grant select, insert, update, delete on public.offer_groups to service_role;
alter table public.offers add column group_id uuid;

-- Same store + identical nonempty product set => one offer, regardless of level.
-- Do not infer entitlements or rewrite any existing plan, code or grant.
do $$
declare
  r record;
  v_key text;
  v_group uuid;
  v_groups jsonb := '{}'::jsonb;
begin
  for r in
    select o.id, o.store_id, o.name,
      array_agg(p.id order by p.id) filter (where p.id is not null) as products,
      string_agg(p.title, ' + ' order by p.id) as title
    from public.offers o
    left join public.offer_products op on op.offer_id = o.id
    left join public.products p on p.id = op.product_id
    group by o.id, o.store_id, o.name order by o.id
  loop
    v_key := r.store_id::text || ':' || coalesce(r.products::text, r.id::text);
    v_group := (v_groups ->> v_key)::uuid;
    if v_group is null then
      insert into public.offer_groups(store_id, name)
        values (r.store_id, coalesce(nullif(btrim(r.title), ''), nullif(btrim(r.name), ''), 'Oferta'))
        returning id into v_group;
      v_groups := v_groups || jsonb_build_object(v_key, v_group);
    end if;
    update public.offers set group_id = v_group where id = r.id;
  end loop;
end;
$$;

alter table public.offers alter column group_id set not null;
alter table public.offers add constraint offers_group_store_fk
  foreign key (group_id, store_id) references public.offer_groups(id, store_id);
create index offers_group_id_idx on public.offers(group_id);
create index offer_groups_store_id_idx on public.offer_groups(store_id);

-- Allow the previous application/RPCs to keep creating a single-plan offer
-- while this additive migration is rolled out before the application.
create function public.assign_legacy_offer_group()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.group_id is null then
    insert into public.offer_groups(store_id, name) values (new.store_id, new.name)
      returning id into new.group_id;
  end if;
  return new;
end;
$$;
create trigger assign_legacy_offer_group before insert on public.offers
  for each row execute function public.assign_legacy_offer_group();

-- Revisions also follow edits from the previous application and direct grant
-- changes. The revision is an opaque token, not a count of user saves.
create function public.bump_offer_group_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_ids uuid[] := '{}'; v_groups uuid[] := '{}'; v_group uuid;
begin
  if tg_table_name = 'offers' then
    if tg_op <> 'INSERT' then v_groups := array_append(v_groups, old.group_id); end if;
    if tg_op <> 'DELETE' then v_groups := array_append(v_groups, new.group_id); end if;
  else
    if tg_op <> 'INSERT' then v_ids := array_append(v_ids, old.offer_id); end if;
    if tg_op <> 'DELETE' then v_ids := array_append(v_ids, new.offer_id); end if;
    select array_agg(distinct group_id) into v_groups from public.offers where id = any(v_ids);
  end if;
  for v_group in select distinct id from unnest(v_groups) ids(id) order by id loop
    -- Old RPCs lock the plan first; do not wait on a grouped editor that
    -- already holds the parent lock. Roll the legacy mutation back instead.
    perform 1 from public.offer_groups where id = v_group for update nowait;
    update public.offer_groups set version = version + 1 where id = v_group;
  end loop;
  return null;
exception when lock_not_available then
  raise exception 'Há uma atualização da oferta em andamento. Recarregue a página e tente novamente.';
end;
$$;
create trigger bump_offer_group_on_plan after insert or update or delete on public.offers
  for each row execute function public.bump_offer_group_version();
create trigger bump_offer_group_on_grant after insert or update or delete on public.offer_products
  for each row execute function public.bump_offer_group_version();

create function public.save_offer_group_atomic(
  p_id uuid, p_store_id uuid, p_name text, p_version integer, p_plans jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_version integer;
  v_plan jsonb;
  v_plan_id uuid;
  v_kept uuid[] := '{}';
  v_removed record;
begin
  if p_name is null or btrim(p_name) = '' then raise exception 'Informe o nome da oferta.'; end if;
  if jsonb_typeof(p_plans) is distinct from 'array' then raise exception 'Planos inválidos.'; end if;
  if jsonb_array_length(p_plans) = 0 then raise exception 'Adicione ao menos um plano.'; end if;
  for v_plan in select value from jsonb_array_elements(p_plans) loop
    if jsonb_typeof(v_plan) is distinct from 'object'
      or jsonb_typeof(v_plan->'name') is distinct from 'string'
      or btrim(v_plan->>'name') = '' then raise exception 'Informe o nome de cada plano.'; end if;
    if jsonb_typeof(v_plan->'payt_product_code') is distinct from 'string'
      or coalesce(v_plan->>'payt_product_code', '') = ''
      or (v_plan->>'payt_product_code') ~ '[[:space:]]' then
      raise exception 'Informe o código da Payt de cada plano, sem espaços.';
    end if;
    if jsonb_typeof(v_plan->'grants') is distinct from 'array' then raise exception 'Produtos inválidos no plano.'; end if;
    if jsonb_array_length(v_plan->'grants') = 0 then raise exception 'Selecione ao menos um produto para cada plano.'; end if;
    if exists (select 1 from jsonb_array_elements(v_plan->'grants') g
      where jsonb_typeof(g) is distinct from 'object'
        or jsonb_typeof(g->'product_id') is distinct from 'string'
        or jsonb_typeof(g->'grant_level') is distinct from 'string'
        or g->>'grant_level' not in ('basic', 'complete')) then
      raise exception 'Produto ou nível inválido: use Básico ou Completo.';
    end if;
    if exists (select 1 from jsonb_array_elements(v_plan->'grants') g group by g->>'product_id' having count(*) > 1) then
      raise exception 'Produto repetido no plano.';
    end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(p_plans) p group by p->>'payt_product_code' having count(*) > 1) then
    raise exception 'Cada plano deve ter um código da Payt diferente.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_plans) p where p->>'id' is not null group by (p->>'id')::uuid having count(*) > 1) then
    raise exception 'Plano repetido na oferta.';
  end if;

  -- Acquire orders before identities when removing, consistent with manual
  -- order creation/deletion. NOWAIT rolls back rather than waiting in a queue.
  if p_id is not null and exists (
    select 1 from public.offers o where o.group_id = p_id
      and not exists (select 1 from jsonb_array_elements(p_plans) p where (p->>'id')::uuid = o.id)
  ) then lock table public.orders in share mode nowait; end if;

  if p_id is null then
    if exists (select 1 from jsonb_array_elements(p_plans) p where p->>'id' is not null) then
      raise exception 'Uma nova oferta só pode conter planos novos.';
    end if;
    insert into public.offer_groups(store_id, name) values (p_store_id, btrim(p_name)) returning id into v_id;
  else
    select id, version into v_id, v_version from public.offer_groups
      where id = p_id and store_id = p_store_id for update nowait;
    if not found then raise exception 'Oferta não encontrada nesta loja. Recarregue a página.'; end if;
    if v_version is distinct from p_version then
      raise exception 'Esta oferta foi alterada. Recarregue a página antes de salvar.';
    end if;
    update public.offer_groups set name = btrim(p_name), version = version + 1 where id = v_id;
  end if;

  for v_plan in select value from jsonb_array_elements(p_plans) loop
    v_plan_id := (v_plan->>'id')::uuid;
    if v_plan_id is null then
      insert into public.offers(store_id, group_id, name, payt_product_code)
        values (p_store_id, v_id, btrim(v_plan->>'name'), v_plan->>'payt_product_code') returning id into v_plan_id;
    else
      perform 1 from public.offers where id = v_plan_id and group_id = v_id and store_id = p_store_id for update nowait;
      if not found then raise exception 'Plano não encontrado nesta oferta e loja. Recarregue a página.'; end if;
    end if;
    perform public.save_offer_levels_atomic(v_plan_id, p_store_id, btrim(v_plan->>'name'), v_plan->>'payt_product_code', v_plan->'grants');
    v_kept := array_append(v_kept, v_plan_id);
  end loop;
  for v_removed in select id, name from public.offers where group_id = v_id and not (id = any(v_kept)) order by id loop
    perform public.delete_offer_atomic(v_removed.id, p_store_id, v_removed.name);
  end loop;
  return v_id;
exception when lock_not_available then
  raise exception 'Há uma atualização em andamento. Aguarde alguns instantes e tente salvar novamente.';
end;
$$;

create function public.delete_offer_group_atomic(p_id uuid, p_store_id uuid, p_confirmation text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_name text; v_plan record;
begin
  lock table public.orders in share mode nowait;
  select name into v_name from public.offer_groups where id = p_id and store_id = p_store_id for update nowait;
  if not found then raise exception 'Oferta não encontrada nesta loja. Recarregue a página.'; end if;
  if p_confirmation is null or btrim(p_confirmation) is distinct from v_name then
    raise exception 'Digite o nome atual da oferta para confirmar a exclusão.';
  end if;
  for v_plan in select id, name from public.offers where group_id = p_id order by id loop
    perform public.delete_offer_atomic(v_plan.id, p_store_id, v_plan.name);
  end loop;
  delete from public.offer_groups where id = p_id and store_id = p_store_id;
exception when lock_not_available then
  raise exception 'Há uma atualização em andamento. Aguarde alguns instantes e tente excluir novamente.';
end;
$$;

revoke execute on function public.assign_legacy_offer_group() from public, anon, authenticated;
revoke execute on function public.bump_offer_group_version() from public, anon, authenticated;
revoke execute on function public.save_offer_group_atomic(uuid,uuid,text,integer,jsonb) from public, anon, authenticated;
revoke execute on function public.delete_offer_group_atomic(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.assign_legacy_offer_group() to service_role;
grant execute on function public.bump_offer_group_version() to service_role;
grant execute on function public.save_offer_group_atomic(uuid,uuid,text,integer,jsonb) to service_role;
grant execute on function public.delete_offer_group_atomic(uuid,uuid,text) to service_role;
