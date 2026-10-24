-- Invoker privileges: only server-side service role may invoke this editor.
create function public.save_contextual_product(
  p_store_id uuid, p_product_id uuid, p_expected_revision bigint,
  p_patch jsonb, p_complement_ids uuid[] default null
) returns table(id uuid, editorial_revision bigint) language plpgsql security invoker set search_path = '' as $$
declare
  v_product public.products;
  v_id uuid;
  v_keys text[];
  v_columns text;
  v_values text;
  v_allowed constant text[] := array[
    'slug','title','track','description','cover_url','banner_url','checkout_url',
    'upgrade_checkout_url','content_mode','upgrade_image_url','upgrade_button_text',
    'purchase_title','purchase_description','purchase_image_url','purchase_button_text',
    'role','student_checkout_url','complementary_product_id','is_featured','sort_order','is_published','catalog_visibility'
  ];
begin
  perform stores.id from public.stores where stores.id=p_store_id for update;
  if not found then raise exception 'Loja inválida.'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'Ficha inválida.'; end if;
  select coalesce(array_agg(key order by key),array[]::text[]) into v_keys from jsonb_object_keys(p_patch) key;
  if not v_keys <@ v_allowed then raise exception 'Campo não permitido na ficha.'; end if;
  if p_product_id is not null then
    select p.* into v_product from public.products p where p.id=p_product_id and p.store_id=p_store_id for update;
    if not found then raise exception 'Produto inválido para esta loja.'; end if;
    if p_expected_revision is null or v_product.editorial_revision <> p_expected_revision then
      raise exception 'Este produto foi alterado. Recarregue antes de salvar.' using errcode='40001';
    end if;
    v_id := p_product_id;
  else
    if p_expected_revision is not null then raise exception 'Revisão inválida para novo produto.'; end if;
    v_id := gen_random_uuid();
  end if;
  if p_complement_ids is not null then
    if cardinality(p_complement_ids) <> (select count(distinct target.id) from unnest(p_complement_ids) target(id))
      or v_id=any(p_complement_ids) then raise exception 'Lista de complementos inválida.'; end if;
    if exists(select 1 from unnest(p_complement_ids) target(id) where not exists(
      select 1 from public.products p where p.id=target.id and p.store_id=p_store_id
    )) then raise exception 'Complemento não encontrado nesta loja.'; end if;
  end if;
  -- Identifiers are whitelisted and quoted; all values remain bound JSON parameters.
  if p_product_id is null then
    select string_agg(format('%I',k),','), string_agg(format('r.%I',k),',') into v_columns,v_values from unnest(v_keys) k;
    execute format('insert into public.products(id,store_id%s) select $1,$2%s from jsonb_populate_record(null::public.products,$3) r',
      case when v_columns is null then '' else ','||v_columns end,
      case when v_values is null then '' else ','||v_values end) using v_id,p_store_id,p_patch;
  else
    select string_agg(format('%I = r.%I',k,k),',') into v_columns from unnest(v_keys) k;
    execute format('update public.products p set updated_at=now()%s from jsonb_populate_record($1::public.products,$2) r where p.id=$3 and p.store_id=$4',
      case when v_columns is null then '' else ','||v_columns end) using v_product,p_patch,v_id,p_store_id;
  end if;
  if p_complement_ids is not null then
    delete from public.product_complements where store_id=p_store_id and parent_product_id=v_id;
    insert into public.product_complements(store_id,parent_product_id,complement_product_id,sort_order)
      select p_store_id,v_id,targets.id,(targets.position-1)::integer from unnest(p_complement_ids) with ordinality as targets(id,position);
  end if;
  return query select p.id,p.editorial_revision from public.products p where p.id=v_id;
end $$;
revoke all on function public.save_contextual_product(uuid,uuid,bigint,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.save_contextual_product(uuid,uuid,bigint,jsonb,uuid[]) to service_role;
