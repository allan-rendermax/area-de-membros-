-- Orders identify offers by the globally unique Payt code, not a foreign key.
-- Keep the guarded lookup short while serializing it with order writes.
create index if not exists orders_payt_product_code_idx on public.orders (payt_product_code);

create or replace function public.delete_offer_atomic(p_id uuid, p_store_id uuid, p_confirmation text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_code text;
begin
  -- A row lock on offers alone cannot prevent a concurrent order insert.
  -- NOWAIT avoids queuing behind webhooks or holding orders while an editor saves.
  lock table public.orders in share mode nowait;
  select o.name, o.payt_product_code into v_name, v_code
    from public.offers o where o.id = p_id and o.store_id = p_store_id
    for update nowait;
  if not found then
    raise exception 'Oferta não encontrada nesta loja. Recarregue a página.';
  end if;
  if p_confirmation is null or p_confirmation = '' or btrim(p_confirmation) is distinct from v_name then
    raise exception 'Digite o nome atual da oferta para confirmar a exclusão. Se ele foi alterado, recarregue a página.';
  end if;
  -- Include every status and orders recorded before the offer was registered.
  if exists (select 1 from public.orders o where o.payt_product_code = v_code) then
    raise exception 'Esta oferta possui pedidos e não pode ser excluída. Preserve os vínculos dos compradores. Para ocultar um produto, desmarque Publicado na edição do produto e salve.';
  end if;
  -- Cascades only to offer_products; products, content and orders are preserved.
  delete from public.offers where id = p_id and store_id = p_store_id;
exception
  when lock_not_available then
    raise exception 'Há uma atualização de pedidos ou ofertas em andamento. Aguarde alguns instantes e tente excluir novamente.';
end;
$$;

revoke execute on function public.delete_offer_atomic(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.delete_offer_atomic(uuid,uuid,text) to service_role;
