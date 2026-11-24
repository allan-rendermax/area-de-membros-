-- Private direct-message support state. Only the server's service_role can use it.
create table public.agent_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.agent_conversations (
  id text primary key, -- Zernio conversationId
  store_id uuid not null references public.stores(id) on delete cascade,
  account_id text not null,
  platform text not null check (platform in ('instagram','facebook')),
  customer_name text,
  state text not null default 'active' check (state in ('active','escalated','paused')),
  paused_until timestamptz,
  processing_until timestamptz null,
  lookup_misses integer not null default 0,
  last_incoming_at timestamptz,
  created_at timestamptz not null default now()
);
create index agent_conversations_store on public.agent_conversations(store_id);

create table public.agent_messages (
  id text primary key, -- Zernio message ID
  conversation_id text not null references public.agent_conversations(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  author text not null check (author in ('cliente','agente','allan')),
  text text not null,
  created_at timestamptz not null default now()
);
create index agent_messages_conversation on public.agent_messages(conversation_id,created_at);

create table public.agent_escalations (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.agent_conversations(id) on delete cascade,
  reason text not null,
  telegram_chat_id bigint,
  telegram_message_id bigint,
  state text not null default 'open' check (state in ('open','answered')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index agent_escalations_conversation on public.agent_escalations(conversation_id);
create unique index agent_escalations_telegram_message on public.agent_escalations(telegram_chat_id,telegram_message_id);

create table public.agent_knowledge (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  topic text not null,
  rule text not null,
  origin text not null check (origin in ('inicial','allan')),
  active boolean not null default true,
  source_escalation uuid references public.agent_escalations(id) on delete set null,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);
create index agent_knowledge_store on public.agent_knowledge(store_id,active);
create index agent_knowledge_source on public.agent_knowledge(source_escalation);

alter table public.agent_settings enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_escalations enable row level security;
alter table public.agent_knowledge enable row level security;
revoke all on public.agent_settings,public.agent_conversations,public.agent_messages,public.agent_escalations,public.agent_knowledge from public,anon,authenticated;
grant select,insert,update,delete on public.agent_settings,public.agent_conversations,public.agent_messages,public.agent_escalations,public.agent_knowledge to service_role;

-- Increment in one statement so concurrent tool contexts cannot lose a miss.
create function public.agent_increment_lookup_miss(p_conversation_id text) returns integer
language sql volatile security invoker set search_path='' as $$
  update public.agent_conversations set lookup_misses=lookup_misses+1
  where id=p_conversation_id returning lookup_misses;
$$;
revoke all on function public.agent_increment_lookup_miss(text) from public,anon,authenticated;
grant execute on function public.agent_increment_lookup_miss(text) to service_role;

-- Existing actions remain Telegram actions; both origins share the customer lock.
alter table public.telegram_support_actions
  alter column user_id drop not null,
  alter column chat_id drop not null,
  add column origin text not null default 'telegram' check (origin in ('telegram','agente')),
  add column conversation_id text null references public.agent_conversations(id) on delete set null,
  add constraint telegram_support_actions_telegram_identity
    check (origin='agente' or (user_id is not null and chat_id is not null));

create index telegram_support_actions_conversation
  on public.telegram_support_actions(conversation_id, finished_at);

create or replace function public.telegram_support_metrics(p_store uuid,p_start timestamptz,p_end timestamptz) returns jsonb
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
  'resends',(select count(*) from actions where origin='telegram' and state='done' and log_id is not null),
  'agentResends',(select count(*) from actions where origin='agente' and state='done' and log_id is not null),
  'corrections',(select count(*) from actions where correction_confirmed),
  'refused',(select count(*) from actions where state='done' and log_id is null),
  'uncertain',(select count(*) from telegram_support_actions where store_id=p_store and state in ('processing','uncertain'))
);
$$;
revoke all on function public.telegram_support_metrics(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.telegram_support_metrics(uuid,timestamptz,timestamptz) to service_role;

-- Approved knowledge is scoped by store slug, never by an installation-specific UUID.
insert into public.agent_knowledge(store_id,topic,rule,origin)
select stores.id,seed.topic,seed.rule,'inicial'
from public.stores
cross join (values
  ('patologias','Atlas de Patologias: https://patologias.casadoconhecimento.online/ — Básico R$ 19,90; Completo R$ 36,90 (3 bônus); Arq Black R$ 97.'),
  ('paisagismo','Atlas de Paisagismo Tropical: https://paisagismo.casadoconhecimento.online/ — Básico R$ 19,90; Completo R$ 36,90 (3 bônus); Arq Black R$ 97.'),
  ('hospitalar','Atlas de Arquitetura Hospitalar: https://hospitalar.casadoconhecimento.online/ — Básico R$ 19,90; Completo R$ 36,90 (3 bônus); Arq Black R$ 97.'),
  ('internacional','Fora do Brasil, somente o Atlas de Patologias tem página internacional: https://patologias.casadoconhecimento.online/internacional — pagamento pela Hotmart, em dólar. Para Paisagismo Tropical e Arquitetura Hospitalar, escalar quem está fora do Brasil. Compras Hotmart são orientadas e escaladas; o agente só resolve reenvios de compras Payt da loja arquitetura dos três Atlas.'),
  ('entrega','é digital, chega no e-mail, olhe o spam'),
  ('area_membros','A área de membros é https://members.grupoelevamax.com/arquitetura/entrar'),
  ('marina','Marina Costa é arquiteta e o rosto da linha Atlas desde 24/11/2026.'),
  ('critica_tecnica','leitura visual não substitui profissional habilitado'),
  ('escalacao','Vou verificar com a equipe e te respondo aqui 💛')
) as seed(topic,rule)
where stores.slug='arquitetura';
