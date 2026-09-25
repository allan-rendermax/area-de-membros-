-- The global admin validates the selected product/store before calling these
-- RPCs. Enforce item -> module -> product integrity inside the mutation too.
create or replace function public.delete_item_scoped_atomic(
  p_item_id uuid,
  p_product_id uuid
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Use the same parent lock as reordering, so concurrent item mutations do not
  -- interleave. It also prevents moving the module to another product meanwhile.
  perform 1 from public.modules m
    join public.items i on i.module_id = m.id
    where i.id = p_item_id and m.product_id = p_product_id
    for update of m;

  delete from public.items i
    using public.modules m
    where i.id = p_item_id and i.module_id = m.id and m.product_id = p_product_id;
  if not found then
    raise exception 'Item inválido para este produto.';
  end if;
end;
$$;

create or replace function public.move_item_scoped_atomic(
  p_item_id uuid,
  p_module_id uuid,
  p_product_id uuid,
  p_direction text
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_position integer;
  v_target integer;
  v_neighbor uuid;
begin
  if p_direction is null or p_direction not in ('up', 'down') then
    raise exception 'Direção inválida.';
  end if;

  perform 1 from public.modules m
    where m.id = p_module_id and m.product_id = p_product_id
    for update;
  if not found then
    raise exception 'Módulo inválido para este produto.';
  end if;

  -- Lock siblings before taking their ordering snapshot. The parent lock also
  -- serializes these RPCs and FK inserts into this module.
  perform 1 from public.items i where i.module_id = p_module_id order by i.id for update;
  select array_agg(i.id order by i.sort_order, i.created_at, i.id) into v_ids
    from public.items i where i.module_id = p_module_id;
  v_position := array_position(v_ids, p_item_id);
  if v_position is null then
    raise exception 'Item inválido para este produto.';
  end if;

  v_target := v_position + case when p_direction = 'up' then -1 else 1 end;
  if v_target < 1 or v_target > array_length(v_ids, 1) then
    return;
  end if;
  v_neighbor := v_ids[v_target];
  v_ids[v_target] := p_item_id;
  v_ids[v_position] := v_neighbor;

  update public.items i
    set sort_order = (ordered.position - 1)::integer
    from unnest(v_ids) with ordinality as ordered(id, position), public.modules m
    where i.id = ordered.id and i.module_id = p_module_id
      and i.module_id = m.id and m.product_id = p_product_id;
end;
$$;

revoke execute on function public.delete_item_scoped_atomic(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.move_item_scoped_atomic(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.delete_item_scoped_atomic(uuid, uuid) to service_role;
grant execute on function public.move_item_scoped_atomic(uuid, uuid, uuid, text) to service_role;
