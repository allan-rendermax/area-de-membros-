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
    where lower(btrim(e.customer_email)) = v_email
      or lower(btrim(e.payload #>> '{customer,email}')) = v_email
      or exists (select 1 from public.orders o
        where lower(btrim(o.customer_email)) = v_email
          and o.payt_transaction_id = e.payload ->> 'transaction_id');
  delete from public.orders where lower(btrim(customer_email)) = v_email;
  delete from public.email_log where customer_id = p_id
    or (customer_id is null and lower(btrim(to_email)) = v_email);
  delete from public.login_attempts where email_hash = p_email_hash;

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
