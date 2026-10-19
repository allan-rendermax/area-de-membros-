-- Somente avisos recebidos após esta implantação entram na fila.
-- Nenhum pedido, acesso, email ou evento antigo é reenfileirado.
create table public.payt_inbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.payt_events(id) on delete cascade,
  event_key text not null unique,
  transaction_id text not null,
  state text not null default 'pending' check (state in ('pending','processing','done','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.payt_inbox enable row level security;
create index payt_inbox_pending_idx on public.payt_inbox(state, available_at);
create index payt_inbox_transaction_idx on public.payt_inbox(transaction_id, state);

create function public.enqueue_payt_postback(p_key text, p_transaction text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_event uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('payt-inbox:' || p_key, 0));
  select id into v_id from payt_inbox where event_key = p_key;
  if v_id is not null then
    -- Uma nova entrega pode recuperar uma falha terminal, mas nunca reabre sucesso.
    update payt_inbox set state='pending', attempts=0, available_at=now(),
      lease_until=null, lease_token=null, last_error=null
      where payt_inbox.id=v_id and state='failed' returning event_id into v_event;
    if v_event is not null then
      update payt_events set outcome='recebido', processed_at=null, error=null where id=v_event;
    end if;
    return v_id;
  end if;
  insert into payt_events(payload, key_valid, outcome)
    values(p_payload, true, 'recebido') returning id into v_event;
  insert into payt_inbox(event_id, event_key, transaction_id)
    values(v_event, p_key, p_transaction) returning id into v_id;
  return v_id;
end;
$$;

create function public.claim_payt_postback()
returns table(id uuid, event_id uuid, transaction_id text, payload jsonb, lease_token uuid)
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  -- Curto lock só para selecionar/arrendar, nunca durante chamadas externas.
  perform pg_advisory_xact_lock(hashtextextended('payt-inbox-claim', 0));
  with exhausted as (
    update payt_inbox q set state='failed', last_error=coalesce(last_error, 'limite de tentativas atingido')
      where q.attempts >= 5 and (q.state='pending' or (q.state='processing' and q.lease_until < now()))
      returning q.event_id, q.last_error
  ) update payt_events e set outcome='erro', error=x.last_error, processed_at=now()
    from exhausted x where e.id=x.event_id;
  select q.id into v_id from payt_inbox q
    where q.attempts < 5 and q.available_at <= now()
      and (q.state='pending' or (q.state='processing' and q.lease_until < now()))
      and not exists (select 1 from payt_inbox other where other.transaction_id=q.transaction_id
        and other.state='processing' and other.lease_until > now())
    order by q.created_at, q.id limit 1 for update skip locked;
  if v_id is null then return; end if;
  return query
    with claimed as (
      update payt_inbox q set state='processing', attempts=q.attempts+1,
        lease_until=now()+interval '5 minutes', lease_token=gen_random_uuid()
      where q.id=v_id returning q.*
    ) select c.id, c.event_id, c.transaction_id, e.payload, c.lease_token
      from claimed c join payt_events e on e.id=c.event_id;
end;
$$;

revoke all on public.payt_inbox from public, anon, authenticated;
grant all on public.payt_inbox to service_role;
revoke execute on function public.enqueue_payt_postback(text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.claim_payt_postback() from public, anon, authenticated;
grant execute on function public.enqueue_payt_postback(text,text,jsonb) to service_role;
grant execute on function public.claim_payt_postback() to service_role;
