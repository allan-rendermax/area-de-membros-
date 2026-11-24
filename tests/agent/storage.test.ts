import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

let db: PGlite
const store = '00000000-0000-4000-8000-000000000001'
const customer = '00000000-0000-4000-8000-000000000002'
const otherStore = '00000000-0000-4000-8000-000000000003'
const legacyAction = '00000000-0000-4000-8000-000000000004'
const log = '00000000-0000-4000-8000-000000000005'
const offer = '00000000-0000-4000-8000-000000000006'
const product = '00000000-0000-4000-8000-000000000007'
const agentTables = ['agent_settings', 'agent_conversations', 'agent_messages', 'agent_escalations', 'agent_knowledge']

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.stores(id uuid primary key,slug text);
    create table public.customers(id uuid primary key,email text,blocked_at timestamptz);
    create table public.email_log(id uuid primary key,customer_id uuid,store_id uuid,to_email text,created_at timestamptz,kind text,status text);
    create table public.orders(store_id uuid,customer_email text,payt_transaction_id text,payt_product_code text,offer_id uuid,status text,is_test boolean,source text,paid_at timestamptz,created_at timestamptz);
    create table public.offers(id uuid,store_id uuid,payt_product_code text,match_type text);
    create table public.offer_products(offer_id uuid,product_id uuid);
    create table public.products(id uuid,is_published boolean);
    insert into public.stores values('${store}','arquitetura'),('${otherStore}','outra-loja');
    insert into public.customers values('${customer}','customer@example.test',null);
  `)
  for (const migration of ['20261025010000_telegram_support.sql', '20261025020000_telegram_monitoring.sql', '20261026010000_telegram_team.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'))
  }
  await db.query(`insert into public.telegram_support_actions(id,user_id,chat_id,customer_id,store_id,kind,expected_email)
    values($1,123,123,$2,$3,'resend','customer@example.test')`, [legacyAction, customer, store])
  // Discover the new migration so RED exercises missing schema rather than a missing-file error.
  for (const migration of readdirSync('supabase/migrations').filter(name => name === '20261124010000_support_agent.sql')) {
    await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'))
  }
})
beforeEach(async () => { await db.exec('begin') })
afterEach(async () => { await db.exec('rollback') })
afterAll(async () => { await db?.close() })

async function conversation(id = 'conversation-1') {
  return db.query(`insert into public.agent_conversations(id,store_id,account_id,platform)
    values($1,$2,'instagram-account','instagram') returning *`, [id, store])
}

describe('ações e métricas compartilhadas com Telegram', () => {
  it('aceita ação do agente sem usuário do Telegram', async () => {
    const result = await db.query(`insert into public.telegram_support_actions(origin,user_id,chat_id,customer_id,store_id,kind,expected_email)
      values('agente',null,null,$1,$2,'resend','customer@example.test') returning origin,user_id,chat_id`, [customer, store])
    expect(result.rows).toEqual([{ origin: 'agente', user_id: null, chat_id: null }])
  })

  it('vincula ação do agente à conversa', async () => {
    await conversation()
    const action = await db.query<{ id: string }>(`insert into public.telegram_support_actions(origin,conversation_id,customer_id,store_id,kind,expected_email)
      values('agente','conversation-1',$1,$2,'resend','customer@example.test') returning id`, [customer, store])
    const actionId = action.rows[0].id
    const linked = await db.query('select origin,conversation_id from public.telegram_support_actions where id=$1', [actionId])
    expect(linked.rows).toEqual([{ origin: 'agente', conversation_id: 'conversation-1' }])

    await db.query('delete from public.agent_conversations where id=$1', ['conversation-1'])
    const unlinked = await db.query('select origin,conversation_id from public.telegram_support_actions where id=$1', [actionId])
    expect(unlinked.rows).toEqual([{ origin: 'agente', conversation_id: null }])
  })

  it('recusa ação do Telegram sem usuário', async () => {
    await expect(db.query(`insert into public.telegram_support_actions(origin,user_id,chat_id,customer_id,store_id,kind,expected_email)
      values('telegram',null,123,$1,$2,'resend','customer@example.test')`, [customer, store])).rejects.toMatchObject({ code: '23514' })
  })

  it('recusa ação do Telegram sem chat', async () => {
    await expect(db.query(`insert into public.telegram_support_actions(user_id,chat_id,customer_id,store_id,kind,expected_email)
      values(123,null,$1,$2,'resend','customer@example.test')`, [customer, store])).rejects.toMatchObject({ code: '23514' })
  })

  it('preserva ações existentes e a origem padrão do Telegram', async () => {
    const existing = await db.query('select origin,user_id,chat_id,state from public.telegram_support_actions where id=$1', [legacyAction])
    expect(existing.rows).toEqual([{ origin: 'telegram', user_id: 123, chat_id: 123, state: 'ready' }])
    const inserted = await db.query(`insert into public.telegram_support_actions(user_id,chat_id,customer_id,store_id,kind,expected_email)
      values(123,123,$1,$2,'resend','customer@example.test') returning origin`, [customer, store])
    expect(inserted.rows).toEqual([{ origin: 'telegram' }])
  })

  it.each(['outro', null])('recusa origem inválida: %s', async origin => {
    await expect(db.query(`insert into public.telegram_support_actions(origin,user_id,chat_id,customer_id,store_id,kind,expected_email)
      values($1,123,123,$2,$3,'resend','customer@example.test')`, [origin, customer, store])).rejects.toMatchObject({ code: origin === null ? '23502' : '23514' })
  })

  it('métricas separam reenvios do agente', async () => {
    await db.exec(`
      insert into public.offers values('${offer}','${store}','ATLAS','product');
      insert into public.products values('${product}',true);
      insert into public.offer_products values('${offer}','${product}');
      insert into public.orders values('${store}','customer@example.test','TX','ATLAS',null,'pago',false,'payt','2026-11-24T12:00:00Z','2026-11-24T12:00:00Z');
      insert into public.email_log(id,customer_id,store_id,to_email,created_at,kind,status) select gen_random_uuid(),'${customer}','${store}','customer@example.test','2026-11-24T12:00:00Z','acesso_novo',status from (values('enviado'),('falhou'),('enviado'),('enviado')) as logs(status);
      insert into public.telegram_email_delivery(log_id,event,is_access)
        select id,event,true from (select id,row_number() over(order by id) as n from public.email_log) logs
        join (values(1,'delivered'),(2,'failed'),(3,'unconfirmed'),(4,'complained')) events(n,event) using(n);
      insert into public.email_log(id,store_id,created_at,kind,status) values('${log}','${store}','2026-11-24T12:00:00Z','convite','enviado');
      insert into public.telegram_support_actions(origin,user_id,chat_id,customer_id,store_id,kind,expected_email,state,log_id,finished_at,correction_confirmed) values
        ('telegram',123,123,'${customer}','${store}','resend','customer@example.test','done','${log}','2026-11-24T12:00:00Z',false),
        ('agente',null,null,'${customer}','${store}','resend','customer@example.test','done','${log}','2026-11-24T12:00:00Z',false),
        ('telegram',123,123,'${customer}','${store}','correct','customer@example.test','done',null,'2026-11-24T12:00:00Z',true),
        ('agente',null,null,'${customer}','${store}','resend','customer@example.test','uncertain','${log}',null,false),
        ('agente',null,null,'${customer}','${store}','resend','customer@example.test','done','${log}','2026-11-25T00:00:00Z',false),
        ('agente',null,null,'${customer}','${store}','resend','customer@example.test','done','${log}','2026-11-23T23:59:59Z',false),
        ('agente',null,null,'${customer}','${otherStore}','resend','customer@example.test','done','${log}','2026-11-24T12:00:00Z',false);
    `)
    const result = await db.query<{ value: Record<string, number> }>(`select public.telegram_support_metrics($1,'2026-11-24T00:00:00Z','2026-11-25T00:00:00Z') as value`, [store])
    expect(result.rows[0].value).toEqual({
      sales: 1, accessCustomers: 1, accessEmails: 4, delivered: 1, failed: 1,
      pending: 1, complaints: 1, unknown: 1, resends: 1, agentResends: 1,
      corrections: 1, refused: 1, uncertain: 1,
    })
  })

  it('mantém a trava por cliente entre Telegram e agente', async () => {
    await db.query(`update public.telegram_support_actions set state='uncertain' where id=$1`, [legacyAction])
    await expect(db.query(`insert into public.telegram_support_actions(origin,customer_id,store_id,kind,expected_email,state)
      values('agente',$1,$2,'resend','customer@example.test','processing')`, [customer, store])).rejects.toMatchObject({ code: '23505' })
  })
})

describe('persistência privada do agente', () => {
  it('habilita RLS e permite apenas service_role nas cinco tabelas', async () => {
    for (const table of agentTables) {
      const security = await db.query<{ relrowsecurity: boolean }>('select relrowsecurity from pg_class where oid=to_regclass($1)', [`public.${table}`])
      expect(security.rows).toEqual([{ relrowsecurity: true }])
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        for (const role of ['anon', 'authenticated', 'service_role']) {
          const result = await db.query<{ allowed: boolean }>('select has_table_privilege($1,$2,$3) as allowed', [role, `public.${table}`, privilege])
          expect(result.rows[0].allowed).toBe(role === 'service_role')
        }
      }
    }
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const result = await db.query<{ allowed: boolean }>(`select has_function_privilege($1,'public.telegram_support_metrics(uuid,timestamptz,timestamptz)','execute') as allowed`, [role])
      expect(result.rows[0].allowed).toBe(role === 'service_role')
    }
    await db.exec('set local role service_role')
    const result = await db.query('insert into public.agent_settings(store_id) values($1) returning enabled', [store])
    expect(result.rows).toEqual([{ enabled: false }])
  })

  it('inicia desligado e persiste conversas, mensagens, escalações e aprendizado', async () => {
    const settings = await db.query('insert into public.agent_settings(store_id) values($1) returning enabled,updated_at', [store])
    expect(settings.rows[0]).toMatchObject({ enabled: false, updated_at: expect.any(Date) })
    const created = await conversation()
    expect(created.rows[0]).toMatchObject({ state: 'active', paused_until: null, last_incoming_at: null, created_at: expect.any(Date) })
    await db.query(`insert into public.agent_messages(id,conversation_id,direction,author,text) values('message-1','conversation-1','in','cliente','Valor')`)
    const escalation = await db.query<{ id: string }>(`insert into public.agent_escalations(conversation_id,reason,telegram_chat_id,telegram_message_id)
      values('conversation-1','Dúvida sem resposta',123,456) returning id,state,answered_at,created_at`)
    expect(escalation.rows[0]).toMatchObject({ id: expect.any(String), state: 'open', answered_at: null, created_at: expect.any(Date) })
    const knowledge = await db.query(`insert into public.agent_knowledge(store_id,topic,rule,origin,source_escalation)
      values($1,'duvida','Regra aprovada','allan',$2) returning active,uses,created_at`, [store, escalation.rows[0].id])
    expect(knowledge.rows[0]).toMatchObject({ active: true, uses: 0, created_at: expect.any(Date) })
  })

  it('deduplica mensagens pelo ID Zernio', async () => {
    await conversation()
    await db.exec(`insert into public.agent_messages(id,conversation_id,direction,author,text) values('message-1','conversation-1','in','cliente','Valor')`)
    await expect(db.exec(`insert into public.agent_messages(id,conversation_id,direction,author,text) values('message-1','conversation-1','in','cliente','Valor')`)).rejects.toMatchObject({ code: '23505' })
  })

  it('deduplica a mensagem de escalação no Telegram', async () => {
    await conversation()
    await db.exec(`insert into public.agent_escalations(conversation_id,reason,telegram_chat_id,telegram_message_id) values('conversation-1','Motivo',123,456)`)
    await expect(db.exec(`insert into public.agent_escalations(conversation_id,reason,telegram_chat_id,telegram_message_id) values('conversation-1','Outro motivo',123,456)`)).rejects.toMatchObject({ code: '23505' })
  })

  it.each([
    `insert into public.agent_conversations(id,store_id,account_id,platform) values('invalid','${store}','account','whatsapp')`,
    `update public.agent_conversations set state='invalid' where id='conversation-1'`,
    `insert into public.agent_messages(id,conversation_id,direction,author,text) values('invalid','conversation-1','invalid','cliente','Texto')`,
    `insert into public.agent_messages(id,conversation_id,direction,author,text) values('invalid','conversation-1','out','invalid','Texto')`,
    `insert into public.agent_escalations(conversation_id,reason,state) values('conversation-1','Motivo','invalid')`,
    `insert into public.agent_knowledge(store_id,topic,rule,origin) values('${store}','topic','Regra','invalid')`,
  ])('recusa valores fora dos domínios: %s', async sql => {
    await conversation()
    await expect(db.exec(sql)).rejects.toMatchObject({ code: '23514' })
  })

  it('exige uma conversa existente nas mensagens', async () => {
    await expect(db.exec(`insert into public.agent_messages(id,conversation_id,direction,author,text) values('invalid','missing','in','cliente','Texto')`)).rejects.toMatchObject({ code: '23503' })
  })
})

describe('banco inicial de respostas', () => {
  it('seed tem preços dos três Atlas', async () => {
    const result = await db.query<{ rule: string }>(`select rule from public.agent_knowledge where store_id=$1 and rule like '%R$ 19,90%' and rule like '%R$ 36,90%'`, [store])
    expect(result.rows).toHaveLength(3)
    for (const [name, url] of [
      ['Patologias', 'https://patologias.casadoconhecimento.online/'],
      ['Paisagismo Tropical', 'https://paisagismo.casadoconhecimento.online/'],
      ['Arquitetura Hospitalar', 'https://hospitalar.casadoconhecimento.online/'],
    ]) {
      expect(result.rows.some(({ rule }) => rule.includes(name) && rule.includes(url) && rule.includes('3 bônus') && rule.includes('Arq Black R$ 97'))).toBe(true)
    }
  })

  it('limita o seed à arquitetura e inclui entrega, acesso, Marina, limites técnicos e exterior', async () => {
    const result = await db.query<{ store_id: string; origin: string; active: boolean; uses: number; rule: string }>('select store_id,origin,active,uses,rule from public.agent_knowledge')
    expect(result.rows.length).toBeGreaterThanOrEqual(9)
    for (const row of result.rows) expect(row).toMatchObject({ store_id: store, origin: 'inicial', active: true, uses: 0 })
    const rules = result.rows.map(row => row.rule).join('\n')
    for (const text of ['é digital, chega no e-mail, olhe o spam', 'https://members.grupoelevamax.com/arquitetura/entrar', 'Marina Costa', 'arquiteta', 'leitura visual não substitui profissional habilitado', 'https://patologias.casadoconhecimento.online/internacional', 'Hotmart', 'dólar', 'Paisagismo', 'Hospitalar']) {
      expect(rules).toContain(text)
    }
  })

  it('inclui a resposta exata de escalação', async () => {
    const result = await db.query(`select rule from public.agent_knowledge where store_id=$1 and topic='escalacao'`, [store])
    expect(result.rows).toEqual([{ rule: 'Vou verificar com a equipe e te respondo aqui 💛' }])
  })
})
