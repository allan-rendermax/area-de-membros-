-- Apply after 20260924000001_product_role.sql. Legacy purchases retain complete access.
alter table public.products add column upgrade_checkout_url text;
alter table public.modules add column required_level text not null default 'basic'
  constraint modules_required_level_check check (required_level in ('basic', 'complete'));
alter table public.offer_products add column grant_level text not null default 'complete'
  constraint offer_products_grant_level_check check (grant_level in ('basic', 'complete'));

insert into storage.buckets (id, name, public)
values ('arquivos-restritos', 'arquivos-restritos', false)
on conflict (id) do nothing;

create or replace function public.save_offer_levels_atomic(
  p_id uuid,
  p_store_id uuid,
  p_name text,
  p_product_code text,
  p_grants jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_store_id uuid;
  v_code text;
begin
  if p_id is not null then
    select o.id, o.store_id, o.payt_product_code into v_id, v_store_id, v_code
      from public.offers o where o.id = p_id for update;
    if not found or v_store_id is distinct from p_store_id then
      raise exception 'Oferta não encontrada nesta loja. Recarregue a página.';
    end if;
    if v_code is distinct from p_product_code then
      raise exception 'O código da Payt não pode ser alterado. Cadastre uma nova oferta para usar outro código.';
    end if;
  end if;

  if p_grants is null or jsonb_typeof(p_grants) <> 'array' or jsonb_array_length(p_grants) = 0 then
    raise exception 'Selecione ao menos um produto para a oferta.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_grants) g
    where jsonb_typeof(g) <> 'object'
       or jsonb_typeof(g->'product_id') <> 'string'
       or jsonb_typeof(g->'grant_level') <> 'string'
       or g->>'grant_level' not in ('basic', 'complete')
  ) then
    raise exception 'Nível de acesso ou produto inválido na oferta.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_grants) as g(product_id uuid, grant_level text)
    group by g.product_id having count(distinct g.grant_level) > 1
  ) then
    raise exception 'Níveis conflitantes para o mesmo produto.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_grants) as g(product_id uuid, grant_level text)
    left join public.products p on p.id = g.product_id and p.store_id = p_store_id
    where p.id is null
  ) then
    raise exception 'Há produto inexistente ou de outra loja na oferta.';
  end if;

  if p_id is null then
    insert into public.offers (store_id, name, payt_product_code)
    values (p_store_id, p_name, p_product_code) returning id into v_id;
  else
    update public.offers set name = p_name where id = v_id;
  end if;
  delete from public.offer_products where offer_id = v_id;
  insert into public.offer_products (offer_id, product_id, grant_level)
  select v_id, g.product_id, max(g.grant_level)
    from jsonb_to_recordset(p_grants) as g(product_id uuid, grant_level text)
    group by g.product_id;
  return v_id;
end;
$$;

revoke execute on function public.save_offer_levels_atomic(uuid,uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.save_offer_levels_atomic(uuid,uuid,text,text,jsonb) to service_role;

-- Older callers provide only product IDs. Reused links retain their previous level.
create or replace function public.save_offer_atomic(
  p_id uuid,
  p_store_id uuid,
  p_name text,
  p_product_code text,
  p_product_ids uuid[]
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_grants jsonb;
  v_store_id uuid;
  v_code text;
begin
  if p_id is not null then
    -- Serialize with tier-aware edits before snapshotting existing link levels.
    select o.store_id, o.payt_product_code into v_store_id, v_code
      from public.offers o where o.id = p_id for update;
    if not found or v_store_id is distinct from p_store_id then
      raise exception 'Oferta não encontrada nesta loja. Recarregue a página.';
    end if;
    if v_code is distinct from p_product_code then
      raise exception 'O código da Payt não pode ser alterado. Cadastre uma nova oferta para usar outro código.';
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', selected.product_id,
    'grant_level', coalesce(existing.grant_level, 'complete')
  )), '[]'::jsonb) into v_grants
  from (select distinct product_id from unnest(p_product_ids) as ids(product_id)) selected
  left join public.offer_products existing
    on existing.offer_id = p_id and existing.product_id = selected.product_id;
  return public.save_offer_levels_atomic(p_id, p_store_id, p_name, p_product_code, v_grants);
end;
$$;

revoke execute on function public.save_offer_atomic(uuid,uuid,text,text,uuid[]) from public, anon, authenticated;
grant execute on function public.save_offer_atomic(uuid,uuid,text,text,uuid[]) to service_role;
