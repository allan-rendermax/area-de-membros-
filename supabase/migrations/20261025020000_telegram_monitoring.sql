-- Cache only delivery metadata for emails already owned by this platform.
alter table public.email_log add column access_notice boolean;
create table public.telegram_email_delivery (
  log_id uuid primary key references public.email_log(id) on delete cascade,
  event text not null,
  is_access boolean not null,
  checked_at timestamptz not null default now()
);
create table public.telegram_support_jobs (
  key text primary key,
  lease_until timestamptz not null default '-infinity',
  last_success_at timestamptz
);
create table public.telegram_support_reports (
  store_id uuid not null references public.stores(id) on delete cascade,
  report_date date not null,
  user_id bigint not null check(user_id>0),
  state text not null default 'processing' check(state in ('processing','sent','uncertain')),
  message_id bigint,
  created_at timestamptz not null default now(),
  primary key(store_id,report_date,user_id)
);
alter table public.telegram_support_actions add column finished_at timestamptz;
alter table public.telegram_support_actions add column correction_confirmed boolean not null default false;
alter table public.telegram_email_delivery enable row level security;
alter table public.telegram_support_jobs enable row level security;
alter table public.telegram_support_reports enable row level security;
revoke all on public.telegram_email_delivery,public.telegram_support_jobs,public.telegram_support_reports from public,anon,authenticated;
grant select,insert,update,delete on public.telegram_email_delivery,public.telegram_support_jobs,public.telegram_support_reports to service_role;

create function public.telegram_support_claim_job(p_key text,p_seconds integer) returns boolean
language plpgsql set search_path=public as $$
declare claimed text;
begin
  insert into telegram_support_jobs(key) values(p_key) on conflict do nothing;
  update telegram_support_jobs set lease_until=now()+make_interval(secs=>greatest(1,least(p_seconds,600)))
    where key=p_key and lease_until<now() returning key into claimed;
  return claimed is not null;
end $$;

create function public.telegram_support_failures(p_store uuid,p_offset integer default 0,p_limit integer default 10) returns jsonb
language sql stable set search_path=public as $$
with access_logs as (
  select l.*,coalesce(d.event,case when l.status='falhou' then 'failed' else 'unconfirmed' end) as event
  from email_log l left join telegram_email_delivery d on d.log_id=l.id
  where l.store_id=p_store and l.created_at>=now()-interval '30 days'
    and coalesce(d.is_access,l.access_notice,l.kind in ('acesso_novo','produto_novo'))
), failures as (
  select distinct on (l.customer_id) l.customer_id,c.email,l.to_email,l.event,l.created_at
  from access_logs l join customers c on c.id=l.customer_id
  where l.event in ('bounced','suppressed','failed') and not exists(
    select 1 from access_logs later where later.customer_id=l.customer_id
      and later.created_at>l.created_at and later.event in ('delivered','opened','clicked'))
  order by l.customer_id,l.created_at desc,l.id
), page as (
  select * from failures order by created_at desc,customer_id
  limit greatest(1,least(p_limit,10)) offset greatest(0,p_offset)
)
select jsonb_build_object('total',(select count(*) from failures),
  'rows',coalesce((select jsonb_agg(jsonb_build_object('customerId',customer_id,'email',email,'failedEmail',to_email,'event',event,'date',created_at) order by created_at desc,customer_id) from page),'[]'::jsonb),
  'updatedAt',(select last_success_at from telegram_support_jobs where key='email-sync'),
  'unknown',(select count(*) from email_log l left join telegram_email_delivery d on d.log_id=l.id
    where l.store_id=p_store and l.created_at>=now()-interval '30 days' and d.log_id is null
      and not(l.status='falhou' and coalesce(l.access_notice,l.kind in ('acesso_novo','produto_novo')))));
$$;

create function public.telegram_support_metrics(p_store uuid,p_start timestamptz,p_end timestamptz) returns jsonb
language sql stable set search_path=public as $$
with sales as (
  select * from orders where store_id=p_store and not is_test and source='payt' and status='pago'
    and coalesce(paid_at,created_at)>=p_start and coalesce(paid_at,created_at)<p_end
), emails as (
  select l.*,coalesce(d.event,case when l.status='falhou' then 'failed' else 'unconfirmed' end) as event,
    coalesce(d.is_access,l.access_notice,l.kind in ('acesso_novo','produto_novo')) as is_access,d.log_id as classified
    from email_log l left join telegram_email_delivery d on d.log_id=l.id
    where l.store_id=p_store and l.created_at>=p_start and l.created_at<p_end
), actions as (
  select * from telegram_support_actions where store_id=p_store and finished_at>=p_start and finished_at<p_end
)
select jsonb_build_object(
  'sales',(select count(distinct payt_transaction_id) from sales),
  'accessCustomers',(select count(distinct c.id) from sales s join customers c on c.email=s.customer_email and c.blocked_at is null
    join offers f on f.store_id=p_store and f.payt_product_code=s.payt_product_code
      and (s.offer_id=f.id or (s.offer_id is null and f.match_type='product'))
    join offer_products op on op.offer_id=f.id join products p on p.id=op.product_id and p.is_published),
  'accessEmails',(select count(*) from emails where is_access),
  'delivered',(select count(*) from emails where is_access and event in ('delivered','opened','clicked')),
  'failed',(select count(*) from emails where is_access and event in ('bounced','suppressed','failed')),
  'pending',(select count(*) from emails where is_access and event not in ('delivered','opened','clicked','bounced','suppressed','failed','complained')),
  'complaints',(select count(*) from emails where is_access and event='complained'),
  'unknown',(select count(*) from emails where not is_access and classified is null),
  'resends',(select count(*) from actions where state='done' and log_id is not null),
  'corrections',(select count(*) from actions where correction_confirmed),
  'refused',(select count(*) from actions where state='done' and log_id is null),
  'uncertain',(select count(*) from telegram_support_actions where store_id=p_store and state in ('processing','uncertain'))
);
$$;
revoke all on function public.telegram_support_claim_job(text,integer),public.telegram_support_failures(uuid,integer,integer),public.telegram_support_metrics(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.telegram_support_claim_job(text,integer),public.telegram_support_failures(uuid,integer,integer),public.telegram_support_metrics(uuid,timestamptz,timestamptz) to service_role;
