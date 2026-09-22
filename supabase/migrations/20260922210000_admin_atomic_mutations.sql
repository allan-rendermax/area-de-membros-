-- Apply before deploying callers of these RPCs. Each invocation runs in one database transaction.
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
  v_id uuid;
  v_store_id uuid;
  v_code text;
  v_product_ids uuid[];
begin
  if p_id is not null then
    -- Serialize competing edits of this offer before *any* validation or write.
    select o.id, o.store_id, o.payt_product_code
      into v_id, v_store_id, v_code
      from public.offers o
     where o.id = p_id
     for update;
    if not found or v_store_id is distinct from p_store_id then
      raise exception 'Oferta não encontrada nesta loja. Recarregue a página.';
    end if;
    if v_code is distinct from p_product_code then
      raise exception 'O código da Payt não pode ser alterado. Cadastre uma nova oferta para usar outro código.';
    end if;
  end if;

  select coalesce(array_agg(distinct p.product_id), '{}'::uuid[])
    into v_product_ids
    from unnest(p_product_ids) as p(product_id);
  if cardinality(v_product_ids) = 0 then
    raise exception 'Selecione ao menos um produto para a oferta.';
  end if;
  if exists (
    select 1
      from unnest(p_product_ids) as selected(product_id)
      left join public.products product
        on product.id = selected.product_id and product.store_id = p_store_id
     where product.id is null
  ) then
    raise exception 'Há produto inexistente ou de outra loja na oferta.';
  end if;

  if p_id is null then
    insert into public.offers (store_id, name, payt_product_code)
    values (p_store_id, p_name, p_product_code)
    returning id into v_id;
  else
    update public.offers set name = p_name where id = v_id;
  end if;

  delete from public.offer_products where offer_id = v_id;
  insert into public.offer_products (offer_id, product_id)
  select v_id, selected.product_id from unnest(v_product_ids) as selected(product_id);
  return v_id;
end;
$$;

revoke execute on function public.save_offer_atomic(uuid,uuid,text,text,uuid[]) from public, anon, authenticated;
grant execute on function public.save_offer_atomic(uuid,uuid,text,text,uuid[]) to service_role;

create or replace function public.change_customer_email_atomic(
  p_id uuid,
  p_expected_email text,
  p_new_email text
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_email text;
begin
  select c.email into v_email
    from public.customers c
   where c.id = p_id
   for update;
  if not found then
    raise exception 'Cliente não encontrado.';
  end if;
  if v_email is distinct from p_expected_email then
    raise exception 'O email do cliente mudou. Recarregue a página e tente novamente.';
  end if;
  update public.orders set customer_email = p_new_email where customer_email = v_email;
  update public.customers set email = p_new_email where id = p_id;
end;
$$;

revoke execute on function public.change_customer_email_atomic(uuid,text,text) from public, anon, authenticated;
grant execute on function public.change_customer_email_atomic(uuid,text,text) to service_role;
