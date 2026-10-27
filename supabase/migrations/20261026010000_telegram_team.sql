create table public.telegram_support_members (
  user_id bigint primary key check(user_id between 1 and 9007199254740991),
  name text not null check(length(name) between 1 and 80),
  active boolean not null,
  version integer not null default 1,
  changed_by bigint not null,
  updated_at timestamptz not null default now()
);
create table public.telegram_team_changes (
  id uuid primary key default gen_random_uuid(),
  owner_id bigint not null,
  chat_id bigint not null check(chat_id=owner_id),
  kind text not null check(kind in ('grant','revoke')),
  state text not null check(state in ('input','confirm','done','cancelled')),
  target_id bigint check(target_id between 1 and 9007199254740991),
  target_name text check(length(target_name) between 1 and 80),
  expected_version integer,
  prompt_id bigint,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '15 minutes',
  finished_at timestamptz,
  check(state not in ('confirm','done') or (target_id is not null and target_name is not null and expected_version is not null))
);
create index telegram_team_reply on public.telegram_team_changes(owner_id,prompt_id) where state='input';
alter table public.telegram_support_members enable row level security;
alter table public.telegram_team_changes enable row level security;
revoke all on public.telegram_support_members,public.telegram_team_changes from public,anon,authenticated;
grant select,insert,update,delete on public.telegram_support_members,public.telegram_team_changes to service_role;

create function public.telegram_team_apply(p_id uuid,p_actor bigint,p_owners bigint[]) returns text
language plpgsql set search_path=public as $$
declare a telegram_team_changes; current_version integer;
begin
  if p_owners is null or not coalesce(p_actor=any(p_owners),false) then return 'denied'; end if;
  select * into a from telegram_team_changes where id=p_id and owner_id=p_actor and chat_id=p_actor for update;
  if not found then return 'unavailable'; end if;
  if a.state='done' then return 'done'; end if;
  if a.state<>'confirm' or a.expires_at<=now() then return 'unavailable'; end if;
  if a.target_id=any(p_owners) then return 'protected'; end if;
  perform pg_advisory_xact_lock(a.target_id);
  select version into current_version from telegram_support_members where user_id=a.target_id;
  if coalesce(current_version,0)<>a.expected_version then
    update telegram_team_changes set state='cancelled',finished_at=now() where id=a.id;
    return 'stale';
  end if;
  insert into telegram_support_members(user_id,name,active,version,changed_by)
    values(a.target_id,a.target_name,a.kind='grant',1,p_actor)
    on conflict(user_id) do update set name=excluded.name,active=excluded.active,
      version=telegram_support_members.version+1,changed_by=p_actor,updated_at=now();
  if a.kind='revoke' then
    update telegram_support_actions set state='cancelled'
      where user_id=a.target_id and state in ('ready','awaiting_email','confirm');
  end if;
  update telegram_team_changes set state='done',finished_at=now() where id=a.id;
  return 'applied';
end $$;
revoke all on function public.telegram_team_apply(uuid,bigint,bigint[]) from public,anon,authenticated;
grant execute on function public.telegram_team_apply(uuid,bigint,bigint[]) to service_role;
