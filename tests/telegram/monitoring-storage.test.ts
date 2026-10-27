import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
let db: PGlite
const store = '00000000-0000-4000-8000-000000000001', customer = '00000000-0000-4000-8000-000000000002'
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table stores(id uuid primary key); create table customers(id uuid primary key,email text,blocked_at timestamptz);
    create table email_log(id uuid primary key,customer_id uuid,store_id uuid,to_email text,created_at timestamptz,provider_id text,kind text,status text);
    create table orders(id uuid,store_id uuid,customer_email text,payt_transaction_id text,payt_product_code text,offer_id uuid,status text,is_test boolean,source text,paid_at timestamptz,created_at timestamptz);
    create table offers(id uuid,store_id uuid,payt_product_code text,match_type text); create table offer_products(offer_id uuid,product_id uuid); create table products(id uuid,is_published boolean);
    insert into stores values('${store}'); insert into customers values('${customer}','current@test.com',null);`)
  await db.exec(readFileSync('supabase/migrations/20261025010000_telegram_support.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/20261025020000_telegram_monitoring.sql', 'utf8'))
})
afterAll(async () => { await db?.close() })
it('exclui convites e remove uma falha após entrega posterior, inclusive com e-mail corrigido', async () => {
  await db.exec(`insert into email_log(id,customer_id,store_id,to_email,created_at,provider_id,kind,status) values('00000000-0000-4000-8000-000000000011','${customer}','${store}','old@test.com',now()-interval '2 hours','p1','reenvio','enviado');
    insert into telegram_email_delivery values('00000000-0000-4000-8000-000000000011','bounced',true,now());`)
  const query = () => db.query<{value: {total:number}}>(`select telegram_support_failures('${store}',0,10) as value`)
  expect((await query()).rows[0].value.total).toBe(1)
  await db.exec(`insert into email_log(id,customer_id,store_id,to_email,created_at,provider_id,kind,status) values('00000000-0000-4000-8000-000000000012','${customer}','${store}','current@test.com',now()-interval '1 hour','p2','reenvio','enviado');
    insert into telegram_email_delivery values('00000000-0000-4000-8000-000000000012','delivered',false,now());`)
  expect((await query()).rows[0].value.total).toBe(1)
  await db.exec(`update telegram_email_delivery set is_access=true where log_id='00000000-0000-4000-8000-000000000012'`)
  expect((await query()).rows[0].value.total).toBe(0)
})
it('não permite consulta pública, nem jobs simultâneos, nem relatório duplicado', async () => {
  const r = await db.query<{allowed:boolean}>(`select has_function_privilege('anon','telegram_support_failures(uuid,integer,integer)','execute') as allowed`)
  expect(r.rows[0].allowed).toBe(false)
  expect((await db.query<{ok:boolean}>(`select telegram_support_claim_job('sync',300) as ok`)).rows[0].ok).toBe(true)
  expect((await db.query<{ok:boolean}>(`select telegram_support_claim_job('sync',300) as ok`)).rows[0].ok).toBe(false)
  const insert = `insert into telegram_support_reports(store_id,report_date,user_id) values('${store}','2026-10-25',123) on conflict do nothing returning user_id`
  expect((await db.query(insert)).rows).toHaveLength(1); expect((await db.query(insert)).rows).toHaveLength(0)
})
it('conta transações pagas distintas, ignora testes e respeita checkout e bloqueio', async () => {
  const offer='00000000-0000-4000-8000-000000000021', product='00000000-0000-4000-8000-000000000022'
  await db.exec(`insert into offers values('${offer}','${store}','CODE','checkout'); insert into products values('${product}',true); insert into offer_products values('${offer}','${product}');
    insert into orders(store_id,customer_email,payt_transaction_id,payt_product_code,offer_id,status,is_test,source,paid_at,created_at) values
    ('${store}','current@test.com','TX','CODE','${offer}','pago',false,'payt','2026-10-25T12:00:00Z','2026-10-24T12:00:00Z'),
    ('${store}','current@test.com','TX','CODE',null,'pago',false,'payt','2026-10-25T12:00:00Z','2026-10-25T12:00:00Z'),
    ('${store}','current@test.com','TEST','CODE','${offer}','pago',true,'payt','2026-10-25T12:00:00Z','2026-10-25T12:00:00Z');`)
  const query=()=>db.query<{value:{sales:number;accessCustomers:number}}>(`select telegram_support_metrics('${store}','2026-10-25T03:00:00Z','2026-10-26T02:00:00Z') as value`)
  expect((await query()).rows[0].value).toMatchObject({sales:1,accessCustomers:1})
  await db.exec(`update customers set blocked_at=now() where id='${customer}'`)
  expect((await query()).rows[0].value.accessCustomers).toBe(0)
})

it('inclui falhas locais sem ID do provedor e identifica entregas ainda pendentes', async () => {
  await db.exec(`insert into email_log(id,customer_id,store_id,to_email,created_at,provider_id,kind,status,access_notice) values
    ('00000000-0000-4000-8000-000000000031','${customer}','${store}','current@test.com',now(),null,'reenvio','falhou',true),
    ('00000000-0000-4000-8000-000000000032','${customer}','${store}','current@test.com',now(),'pending','acesso_novo','enviado',true);
    insert into telegram_email_delivery values('00000000-0000-4000-8000-000000000032','delivery_delayed',true,now());`)
  const result=await db.query<{value:{total:number;rows:{event:string}[]}}>(`select telegram_support_failures('${store}',0,10) as value`)
  expect(result.rows[0].value.total).toBe(1);expect(result.rows[0].value.rows[0].event).toBe('failed')
  const metrics=await db.query<{value:{pending:number;failed:number}}>(`select telegram_support_metrics('${store}',now()-interval '1 minute',now()+interval '1 minute') as value`)
  expect(metrics.rows[0].value).toMatchObject({pending:1,failed:1})
})
