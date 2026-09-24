-- Stable ownership survives email corrections and allows FK cascades on deletion.
alter table public.payt_events add column customer_id uuid references public.customers(id) on delete cascade;
alter table public.login_attempts add column customer_id uuid references public.customers(id) on delete cascade;
create index payt_events_customer_id_idx on public.payt_events(customer_id);
create index login_attempts_customer_id_idx on public.login_attempts(customer_id);

create or replace function public.link_payt_event_customer()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_ids uuid[];
begin
  -- A later webhook summary must never transfer an already-owned event.
  if tg_op = 'UPDATE' and old.customer_id is not null then
    new.customer_id := old.customer_id;
    return new;
  end if;
  if new.customer_id is not null then return new; end if;
  select array_agg(distinct c.id) into v_ids from public.customers c
    where ((lower(btrim(c.email)) = lower(btrim(new.customer_email))
      or lower(btrim(c.email)) = lower(btrim(new.payload #>> '{customer,email}')))
      and c.created_at <= new.received_at)
    or exists (select 1 from public.orders o
      where o.customer_email = c.email
        and o.payt_transaction_id = new.payload ->> 'transaction_id');
  -- An event covering different identities has no single safe owner.
  if cardinality(v_ids) = 1 then new.customer_id := v_ids[1]; end if;
  return new;
end;
$$;
create trigger link_payt_event_customer before insert or update of payload, customer_email on public.payt_events
  for each row execute function public.link_payt_event_customer();

-- Backfill attributable events, including those logged before the paid account
-- was created (their transaction identifies the persisted customer).
update public.payt_events set customer_email = customer_email where customer_id is null;

create or replace function public.link_history_before_customer_email_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.email is not distinct from old.email then return new; end if;
  update public.payt_events set customer_email = customer_email
    where customer_id is null and received_at >= old.created_at
      and (lower(btrim(customer_email)) = lower(btrim(old.email))
        or lower(btrim(payload #>> '{customer,email}')) = lower(btrim(old.email)));
  update public.email_log set customer_id = old.id
    where customer_id is null and created_at >= old.created_at
      and lower(btrim(to_email)) = lower(btrim(old.email));
  return new;
end;
$$;
create trigger link_history_before_customer_email_change before update of email on public.customers
  for each row execute function public.link_history_before_customer_email_change();

create or replace function public.change_customer_email_tracked_atomic(
  p_id uuid, p_expected_email text, p_new_email text, p_previous_email_hash text
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_created_at timestamptz;
begin
  select c.created_at into v_created_at from public.customers c
    where c.id = p_id and c.email = p_expected_email for update;
  if not found then raise exception 'O email do cliente mudou. Recarregue a página e tente novamente.'; end if;
  if coalesce(p_previous_email_hash, '') = '' then raise exception 'Não foi possível vincular o histórico de login.'; end if;
  update public.login_attempts set customer_id = p_id
    where customer_id is null and email_hash = p_previous_email_hash and created_at >= v_created_at;
  perform public.change_customer_email_atomic(p_id, p_expected_email, p_new_email);
end;
$$;

create or replace function public.record_login_attempt_atomic(
  p_ip text, p_email_hash text, p_store_id uuid, p_email text
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if p_email_hash is not null and p_email is not null then
    select c.id into v_id from public.customers c
      where c.email = lower(btrim(p_email)) for key share;
  end if;
  insert into public.login_attempts(ip, email_hash, store_id, customer_id)
    values (p_ip, p_email_hash, p_store_id, v_id);
end;
$$;

-- Protect legacy/manual INSERTs as well as the new RPC during deployment.
create or replace function public.guard_manual_order_references()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.source <> 'manual' then return new; end if;
  perform 1 from public.customers where email = new.customer_email for share;
  if not found then raise exception 'Cliente não encontrado. Recarregue a página.'; end if;
  perform 1 from public.offers where payt_product_code = new.payt_product_code
    and store_id = new.store_id for share;
  if not found then raise exception 'Oferta não encontrada nesta loja. Recarregue a página.'; end if;
  return new;
end;
$$;
create trigger guard_manual_order_references before insert on public.orders
  for each row execute function public.guard_manual_order_references();

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
  insert into public.orders(store_id, payt_transaction_id, payt_product_code,
    payt_product_name, customer_email, status, status_rank, source, is_test,
    paid_at, amount_cents, note, created_by)
  values (p_store_id, 'MANUAL-' || gen_random_uuid()::text, v_code, v_name,
    v_email, 'pago', 1, 'manual', false, now(), 0, coalesce(p_note, ''), p_admin_email);
exception when lock_not_available then
  raise exception 'Há uma atualização em andamento. Recarregue a ficha e tente liberar novamente.';
end;
$$;

revoke execute on function public.link_payt_event_customer() from public, anon, authenticated;
revoke execute on function public.link_history_before_customer_email_change() from public, anon, authenticated;
revoke execute on function public.guard_manual_order_references() from public, anon, authenticated;
revoke execute on function public.change_customer_email_tracked_atomic(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.record_login_attempt_atomic(text,text,uuid,text) from public, anon, authenticated;
revoke execute on function public.create_manual_order_atomic(uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.link_payt_event_customer(), public.link_history_before_customer_email_change(), public.guard_manual_order_references(),
  public.change_customer_email_tracked_atomic(uuid,text,text,text), public.record_login_attempt_atomic(text,text,uuid,text),
  public.create_manual_order_atomic(uuid,uuid,uuid,text,text) to service_role;


-- Prefer stable ownership; never erase history belonging to a different account.
-- Account, purchases and local history are removed in the same transaction.
-- Backend-only: protected emails and login hash come from server configuration.
create or replace function public.delete_customer_atomic(
  p_id uuid,
  p_confirmation text,
  p_protected_emails text[],
  p_email_hash text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_auth_email text;
begin
  if coalesce(cardinality(p_protected_emails), 0) = 0 then
    raise exception 'A proteção de administradores não está configurada.';
  end if;

  -- NOWAIT avoids a queue behind webhooks or email changes. All deletion work
  -- rolls back on contention. New external events after commit can recreate data.
  lock table public.customers, public.orders, public.payt_events,
    public.email_log, public.customer_devices, public.item_access,
    public.member_progress, public.login_attempts in share row exclusive mode nowait;
  select lower(btrim(u.email)) into v_auth_email
    from auth.users u where u.id = p_id for update nowait;
  select lower(btrim(c.email)) into v_email
    from public.customers c where c.id = p_id for update nowait;
  if not found then
    raise exception 'Cliente não encontrado. Recarregue a lista de clientes.';
  end if;
  if exists (select 1 from unnest(p_protected_emails) e
    where lower(btrim(e)) in (v_email, v_auth_email)) then
    raise exception 'Contas de administrador não podem ser excluídas por esta opção.';
  end if;
  if v_email is distinct from lower(btrim(p_confirmation)) then
    raise exception 'Digite o e-mail atual do cliente. Se ele mudou, recarregue a página.';
  end if;
  if v_auth_email is distinct from v_email then
    raise exception 'O e-mail da conta está divergente. Corrija o cadastro antes de excluir.';
  end if;
  if exists (select 1 from storage.objects where owner_id = p_id::text) then
    raise exception 'Esta conta possui arquivos no armazenamento. Transfira os arquivos antes de excluir.';
  end if;

  -- Some events have no parsed summary, or still contain the previous email.
  delete from public.payt_events e
    where e.customer_id = p_id or (e.customer_id is null and (lower(btrim(e.customer_email)) = v_email
      or lower(btrim(e.payload #>> '{customer,email}')) = v_email
      or exists (select 1 from public.orders o
        where lower(btrim(o.customer_email)) = v_email
          and o.payt_transaction_id = e.payload ->> 'transaction_id')));
  delete from public.orders where lower(btrim(customer_email)) = v_email;
  delete from public.email_log where customer_id = p_id
    or (customer_id is null and lower(btrim(to_email)) = v_email);
  delete from public.login_attempts where customer_id = p_id
    or (customer_id is null and email_hash = p_email_hash);

  -- Standard Auth foreign keys cascade identities/sessions/refresh tokens, then
  -- customers and their devices, access events and progress. A failure rolls back
  -- purchases and logs too, unlike separate Auth and PostgREST requests.
  delete from auth.users where id = p_id;
exception when lock_not_available then
  raise exception 'Há uma atualização em andamento. Aguarde alguns instantes e tente excluir novamente.';
end;
$$;

revoke execute on function public.delete_customer_atomic(uuid,text,text[],text) from public, anon, authenticated;
grant execute on function public.delete_customer_atomic(uuid,text,text[],text) to service_role;
