-- Delete only unused, unlinked products. Existing sales configuration and history
-- must be handled explicitly; hiding a product remains available in the admin.
-- email_log stores an array rather than foreign keys. Give new references the
-- same locking/existence protection as an FK, including notices prepared before
-- a deletion but written after it. Existing log rows are not modified.
create or replace function public.guard_email_log_products()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_id uuid;
begin
  for v_product_id in
    select distinct reference.id from unnest(new.product_ids) as reference(id) order by reference.id
  loop
    perform 1 from public.products where id = v_product_id for key share;
    if not found then
      raise exception 'O produto do aviso não existe mais. Recarregue os produtos antes de reenviar.' using errcode = '23503';
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function public.guard_email_log_products() from public, anon, authenticated;
grant execute on function public.guard_email_log_products() to service_role;

create trigger guard_email_log_products
before insert or update of product_ids on public.email_log
for each row execute function public.guard_email_log_products();

create or replace function public.delete_product_atomic(
  p_id uuid,
  p_store_id uuid,
  p_confirmation text
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_title text;
begin
  -- A foreign-key insert linking an offer/access to this product takes a key-share
  -- lock. Serialize with those writes before checking references and cascading.
  select p.title into v_title
    from public.products p
    where p.id = p_id and p.store_id = p_store_id
    for update;

  if not found then
    raise exception 'Produto não encontrado nesta loja. Recarregue a página.';
  end if;
  if p_confirmation is null or p_confirmation = '' or btrim(p_confirmation) is distinct from v_title then
    raise exception 'Digite o nome atual do produto para confirmar a exclusão. Se ele foi alterado, recarregue a página.';
  end if;
  if exists (select 1 from public.offer_products op where op.product_id = p_id) then
    raise exception 'Este produto está vinculado a uma oferta. Revise os vínculos em Ofertas antes de excluir. Para retirá-lo da área, desmarque Publicado e salve.';
  end if;
  if exists (select 1 from public.item_access a where a.product_id = p_id)
     or exists (select 1 from public.member_progress mp where mp.product_id = p_id)
     or exists (select 1 from public.email_log e where e.product_ids @> array[p_id]) then
    raise exception 'Este produto possui histórico de acesso, progresso ou e-mail e não pode ser excluído. Para preservá-lo, desmarque Publicado e salve.';
  end if;

  -- Existing foreign keys remove modules and items. Orders and Storage objects
  -- are intentionally untouched; a file can be shared by more than one product.
  delete from public.products where id = p_id and store_id = p_store_id;
end;
$$;

revoke execute on function public.delete_product_atomic(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.delete_product_atomic(uuid, uuid, text) to service_role;
