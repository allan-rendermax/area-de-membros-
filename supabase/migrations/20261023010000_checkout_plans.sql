-- Checkout plans are opt-in. No offer conversion or order backfill.
alter table public.offers
  add column match_type text not null default 'product' check (match_type in ('product','checkout','upsell')),
  add column checkout_code text,
  add column match_values text[] not null default '{}';
alter table public.offers drop constraint offers_payt_product_code_key;
create index offers_payt_product_code_idx on public.offers(payt_product_code);
alter table public.offers add constraint offers_identity_key unique (id,store_id,payt_product_code);
alter table public.orders
  add column offer_id uuid,
  add column checkout_url text,
  add column upsell_code text,
  add column identification_warning text,
  add constraint orders_offer_store_required check (offer_id is null or store_id is not null),
  add constraint orders_offer_identity_fk foreign key (offer_id,store_id,payt_product_code)
    references public.offers(id,store_id,payt_product_code) on delete restrict;
create index orders_offer_id_idx on public.orders(offer_id);

create function public.normalize_payt_checkout_url(p_url text)
returns text language plpgsql immutable set search_path = '' as $$
declare v_parts text[]; v_path text;
begin
  if p_url is null then return null; end if;
  v_parts := regexp_match(btrim(p_url), '^https://(payt\.site|checkout\.payt\.com\.br)(/[^?#]*)?([?#].*)?$', 'i');
  if v_parts is null then return null; end if;
  v_path := rtrim(coalesce(v_parts[2], ''), '/');
  if v_path = '' or v_path ~ '[[:space:]%\\]' or v_path ~ '(^|/)\.{1,2}(/|$)' then return null; end if;
  return 'https://' || lower(v_parts[1]) || v_path;
end;
$$;


create function public.guard_offer_match_rules()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_values text[] := '{}'; v_value text; v_normal text;
begin
  -- Serialize all writers for a code, including old RPCs and direct inserts.
  perform pg_advisory_xact_lock(hashtextextended(new.payt_product_code, 0));
  if tg_op = 'UPDATE' and (new.payt_product_code is distinct from old.payt_product_code
    or new.match_type is distinct from old.match_type or new.store_id is distinct from old.store_id
    or new.group_id is distinct from old.group_id or new.checkout_code is distinct from old.checkout_code) then
    raise exception 'O código, modo e referência do plano não podem ser alterados. Cadastre um novo plano.';
  end if;
  if new.match_type not in ('product','checkout','upsell') or new.match_type is null then raise exception 'Modo de identificação inválido.'; end if;
  if new.checkout_code is not null and (btrim(new.checkout_code) = '' or new.checkout_code ~ '[[:space:]]') then
    raise exception 'Código de checkout inválido.';
  end if;
  if new.match_values is null then raise exception 'Aliases inválidos.'; end if;
  foreach v_value in array new.match_values loop
    if new.match_type = 'checkout' then v_normal := public.normalize_payt_checkout_url(v_value);
    else v_normal := nullif(btrim(v_value), ''); end if;
    if v_normal is null or v_normal ~ '[[:space:]]' then raise exception 'Alias de checkout ou upsell inválido.'; end if;
    if v_normal = any(v_values) then raise exception 'Alias repetido no plano.'; end if;
    v_values := array_append(v_values,v_normal);
  end loop;
  new.match_values := v_values;
  if (new.match_type = 'product' and cardinality(v_values) <> 0)
    or (new.match_type <> 'product' and cardinality(v_values) = 0) then
    raise exception 'Informe aliases somente para planos por checkout ou upsell.';
  end if;
  if tg_op = 'UPDATE' and not (new.match_values @> old.match_values) then
    raise exception 'Aliases existentes devem ser preservados; adicione os novos aliases.';
  end if;
  if exists (select 1 from public.offers o where o.payt_product_code = new.payt_product_code and o.id <> new.id
    and (o.store_id <> new.store_id or o.group_id <> new.group_id or o.match_type = 'product' or new.match_type = 'product')) then
    raise exception 'Código Payt já utilizado: compartilhe apenas entre planos específicos da mesma oferta e loja.';
  end if;
  if exists (select 1 from public.offers o where o.payt_product_code = new.payt_product_code and o.id <> new.id
    and o.match_type = new.match_type and o.match_values && new.match_values) then
    raise exception 'Alias já utilizado por outro plano deste código Payt.';
  end if;
  return new;
end;
$$;

create trigger guard_offer_match_rules before insert or update on public.offers
  for each row execute function public.guard_offer_match_rules();

create function public.guard_order_offer_binding()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.offer_id is not null and new.offer_id is distinct from old.offer_id then
    raise exception 'O plano persistido do pedido não pode ser alterado.';
  end if;
  if new.source = 'manual' and new.offer_id is null and exists (
    select 1 from public.offers where payt_product_code = new.payt_product_code and match_type <> 'product'
  ) then raise exception 'Selecione o plano para a liberação manual.'; end if;
  return new;
end;
$$;

create trigger guard_order_offer_binding before insert or update on public.orders
  for each row execute function public.guard_order_offer_binding();

-- One transaction resolves and persists the plan and advances status. The legacy
-- apply_order_status stays available for old product-only callers during rollout.
create function public.apply_payt_order_status(
  p_store_id uuid, p_transaction_id text, p_product_code text, p_product_name text,
  p_customer_email text, p_customer_name text, p_status text, p_status_rank smallint,
  p_payt_type text, p_is_test boolean, p_amount_cents integer,
  p_checkout_url text default null, p_upsell_code text default null, p_identifier_invalid boolean default false
) returns table (out_order_id uuid, out_changed boolean, out_status text,
  out_offer_id uuid, out_store_id uuid, out_customer_email text, out_customer_name text, out_identification_warning text)
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype; v_offer uuid; v_matches uuid[]; v_store uuid; v_warning text;
  v_url text := public.normalize_payt_checkout_url(p_checkout_url);
  v_upsell text := nullif(btrim(p_upsell_code), '');
  v_changed boolean := false; v_inserted uuid; v_advance boolean; v_resolve boolean;
begin
  if p_is_test then raise exception 'Eventos de teste não criam pedidos.'; end if;
  if p_status not in ('pendente','pago','cancelado','reembolsado','chargeback') or p_status is null
    or p_status_rank is distinct from (case p_status when 'pendente' then 0 when 'pago' then 1 else 2 end)::smallint then
    raise exception 'Status ou precedência inválidos.';
  end if;
  lock table public.orders in row exclusive mode;
  perform pg_advisory_xact_lock(hashtextextended(p_product_code,0));
  select o.store_id into v_store from public.offers o where o.payt_product_code=p_product_code limit 1;
  if p_store_id is not null and v_store is not null and p_store_id <> v_store then raise exception 'Código Payt de outra loja.'; end if;
  if v_store is null then v_warning := 'codigo_desconhecido';
  else
    select array_agg(o.id) into v_matches from public.offers o where o.payt_product_code=p_product_code
      and (o.match_type='product' or (not coalesce(p_identifier_invalid,false)
        and (p_checkout_url is null or v_url is not null)
        and (p_upsell_code is null or (v_upsell is not null and v_upsell !~ '[[:space:]]'))
        and ((o.match_type='checkout' and v_url=any(o.match_values)) or (o.match_type='upsell' and v_upsell=any(o.match_values)))));
    if cardinality(v_matches)=1 then v_offer := v_matches[1];
    elsif cardinality(v_matches)>1 then v_warning := 'identificador_ambiguo';
    elsif coalesce(p_identifier_invalid,false) or (p_checkout_url is not null and v_url is null)
      or (p_upsell_code is not null and (v_upsell is null or v_upsell ~ '[[:space:]]')) then v_warning := 'identificador_invalido';
    elsif v_url is null and v_upsell is null then v_warning := 'identificador_ausente';
    else v_warning := 'identificador_desconhecido'; end if;
  end if;
  insert into public.orders(store_id,payt_transaction_id,payt_product_code,payt_product_name,customer_email,customer_name,
    status,status_rank,payt_type,is_test,amount_cents,paid_at,offer_id,checkout_url,upsell_code,identification_warning)
    values(v_store,p_transaction_id,p_product_code,p_product_name,lower(btrim(p_customer_email)),p_customer_name,
      p_status,p_status_rank,p_payt_type,false,p_amount_cents,case when p_status='pago' then now() end,v_offer,v_url,v_upsell,v_warning)
    on conflict(payt_transaction_id,payt_product_code) do nothing returning id into v_inserted;
  select * into strict v_order from public.orders where payt_transaction_id=p_transaction_id and payt_product_code=p_product_code for update;
  if v_inserted is not null then v_changed := true;
  else
    if v_order.offer_id is not null then
      if p_checkout_url is null and p_upsell_code is null and not coalesce(p_identifier_invalid,false) then v_warning := null;
      elsif v_offer is distinct from v_order.offer_id then v_warning := 'identificador_conflitante'; end if;
    end if;
    v_advance := v_order.status_rank < p_status_rank;
    v_resolve := v_order.offer_id is null and v_offer is not null;
    v_changed := v_advance or v_resolve;
    update public.orders o set
      offer_id=coalesce(o.offer_id,v_offer), store_id=coalesce(o.store_id,v_store),
      status=case when v_advance then p_status else o.status end,
      status_rank=case when v_advance then p_status_rank else o.status_rank end,
      customer_email=case when v_advance and o.status='pendente' and p_status='pago' then lower(btrim(p_customer_email)) else o.customer_email end,
      customer_name=case when v_advance and o.status='pendente' and p_status='pago' then p_customer_name else o.customer_name end,
      paid_at=coalesce(o.paid_at,case when v_advance and p_status='pago' then now() end),
      checkout_url=case when o.offer_id is null then v_url else o.checkout_url end,
      upsell_code=case when o.offer_id is null then v_upsell else o.upsell_code end,
      identification_warning=v_warning, updated_at=now()
    where o.id=v_order.id returning o.* into v_order;
  end if;
  return query select v_order.id,v_changed,v_order.status,v_order.offer_id,v_order.store_id,
    v_order.customer_email,v_order.customer_name,v_order.identification_warning;
end;
$$;


revoke execute on function public.normalize_payt_checkout_url(text), public.guard_offer_match_rules(), public.guard_order_offer_binding(),
  public.apply_payt_order_status(uuid,text,text,text,text,text,text,smallint,text,boolean,integer,text,text,boolean) from public,anon,authenticated;
grant execute on function public.normalize_payt_checkout_url(text), public.guard_offer_match_rules(), public.guard_order_offer_binding(),
  public.apply_payt_order_status(uuid,text,text,text,text,text,text,smallint,text,boolean,integer,text,text,boolean) to service_role;

create or replace function public.save_offer_group_atomic(
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
    if v_plan ? 'match_values' and jsonb_typeof(v_plan->'match_values') is distinct from 'array' then raise exception 'Aliases inválidos.'; end if;
    if exists (select 1 from jsonb_array_elements(coalesce(v_plan->'match_values','[]'::jsonb)) a where jsonb_typeof(a) is distinct from 'string') then raise exception 'Aliases inválidos.'; end if;
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
      insert into public.offers(store_id, group_id, name, payt_product_code, match_type, checkout_code, match_values)
        values (p_store_id, v_id, btrim(v_plan->>'name'), v_plan->>'payt_product_code', coalesce(v_plan->>'match_type','product'), v_plan->>'checkout_code', array(select jsonb_array_elements_text(coalesce(v_plan->'match_values','[]'::jsonb)))) returning id into v_plan_id;
    else
      perform 1 from public.offers where id = v_plan_id and group_id = v_id and store_id = p_store_id for update nowait;
      if not found then raise exception 'Plano não encontrado nesta oferta e loja. Recarregue a página.'; end if;
      update public.offers set match_type=coalesce(v_plan->>'match_type','product'), checkout_code=v_plan->>'checkout_code',
        match_values=array(select jsonb_array_elements_text(coalesce(v_plan->'match_values','[]'::jsonb))) where id=v_plan_id;
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



create or replace function public.create_manual_order_atomic(
  p_store_id uuid, p_offer_id uuid, p_customer_id uuid, p_admin_email text, p_note text
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_email text; v_name text; v_code text;
begin
  -- Acquire the order-write lock before locking identities, matching offer
  -- deletion. NOWAIT means contention fails instead of leaving a lock queue.
  lock table public.orders in row exclusive mode nowait;
  select email into v_email from public.customers where id = p_customer_id for share nowait;
  if not found then raise exception 'Cliente não encontrado. Recarregue a página.'; end if;
  select name, payt_product_code into v_name, v_code from public.offers
    where id = p_offer_id and store_id = p_store_id for share nowait;
  if not found then raise exception 'Oferta não encontrada nesta loja. Recarregue a página.'; end if;
  insert into public.orders(offer_id, store_id, payt_transaction_id, payt_product_code,
    payt_product_name, customer_email, status, status_rank, source, is_test,
    paid_at, amount_cents, note, created_by)
  values (p_offer_id, p_store_id, 'MANUAL-' || gen_random_uuid()::text, v_code, v_name,
    v_email, 'pago', 1, 'manual', false, now(), 0, coalesce(p_note, ''), p_admin_email);
exception when lock_not_available then
  raise exception 'Há uma atualização em andamento. Recarregue a ficha e tente liberar novamente.';
end;
$$;



create or replace function public.store_customer_success(p_store_id uuid)
returns table (
  customer_id uuid,
  email text,
  first_paid_at timestamptz,
  paid_orders integer,
  last_seen_at timestamptz,
  item_opens integer,
  last_item_open_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with buyers as (
    select o.customer_email,
           min(coalesce(o.paid_at, o.created_at)) as first_paid_at,
           count(*)::integer as paid_orders
      from public.orders o
      join public.offers f on f.payt_product_code = o.payt_product_code
       and ((o.offer_id is not null and f.id=o.offer_id and f.store_id=o.store_id)
         or (o.offer_id is null and f.match_type='product'))
     where f.store_id = p_store_id
       and o.status = 'pago'
     group by o.customer_email
  )
  select c.id,
         c.email,
         b.first_paid_at,
         b.paid_orders,
         (select max(d.last_seen_at) from public.customer_devices d where d.customer_id = c.id),
         (select count(*)::integer from public.item_access a where a.customer_id = c.id and a.store_id = p_store_id),
         (select max(a.created_at) from public.item_access a where a.customer_id = c.id and a.store_id = p_store_id)
    from buyers b
    join public.customers c on c.email = b.customer_email
$$;


revoke execute on function public.store_customer_success(uuid) from public, anon, authenticated;
grant execute on function public.store_customer_success(uuid) to service_role;

revoke execute on function public.create_manual_order_atomic(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_manual_order_atomic(uuid,uuid,uuid,text,text) to service_role;
