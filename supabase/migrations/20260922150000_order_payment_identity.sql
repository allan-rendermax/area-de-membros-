-- A identidade recebida no primeiro pagamento confirmado passa a ser a titularidade
-- do pedido. Eventos duplicados, atrasados e finais preservam correções posteriores.
create or replace function public.apply_order_status(
  p_store_id uuid,
  p_transaction_id text,
  p_product_code text,
  p_product_name text,
  p_customer_email text,
  p_customer_name text,
  p_status text,
  p_status_rank smallint,
  p_payt_type text,
  p_is_test boolean,
  p_amount_cents integer
) returns table (out_order_id uuid, out_changed boolean, out_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  insert into public.orders (
    store_id, payt_transaction_id, payt_product_code, payt_product_name,
    customer_email, customer_name, status, status_rank, payt_type, is_test,
    amount_cents, paid_at
  ) values (
    p_store_id, p_transaction_id, p_product_code, p_product_name,
    lower(btrim(p_customer_email)), p_customer_name, p_status, p_status_rank, p_payt_type, p_is_test,
    p_amount_cents, case when p_status = 'pago' then now() end
  )
  on conflict (payt_transaction_id, payt_product_code) do nothing
  returning id into v_id;

  if v_id is not null then
    return query select v_id, true, p_status;
    return;
  end if;

  update public.orders o
     set status = p_status,
         status_rank = p_status_rank,
         store_id = coalesce(o.store_id, p_store_id),
         customer_email = case
           when o.status = 'pendente' and p_status = 'pago' then lower(btrim(p_customer_email))
           else o.customer_email
         end,
         customer_name = case
           when o.status = 'pendente' and p_status = 'pago' then p_customer_name
           else o.customer_name
         end,
         paid_at = coalesce(o.paid_at, case when p_status = 'pago' then now() end),
         updated_at = now()
   where o.payt_transaction_id = p_transaction_id
     and o.payt_product_code = p_product_code
     and o.status_rank < p_status_rank
  returning o.id, o.status into v_id, v_status;

  if v_id is not null then
    return query select v_id, true, v_status;
    return;
  end if;

  return query
    select o.id, false, o.status
      from public.orders o
     where o.payt_transaction_id = p_transaction_id
       and o.payt_product_code = p_product_code;
end;
$$;

revoke execute on function public.apply_order_status(uuid, text, text, text, text, text, text, smallint, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.apply_order_status(uuid, text, text, text, text, text, text, smallint, text, boolean, integer) to service_role;
