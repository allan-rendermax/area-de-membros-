import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const customer = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const store = '00000000-0000-4000-8000-000000000003'
const offer = '00000000-0000-4000-8000-000000000004'
const dbs: PGlite[] = []
afterEach(async () => { await Promise.all(dbs.splice(0).map(db => db.close())) })
const migration = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}.sql`, import.meta.url), 'utf8')
async function setup() {
  const db = new PGlite(); dbs.push(db)
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text);
    create table storage.objects(owner_id text);
    create table public.customers(id uuid primary key references auth.users on delete cascade, email text unique, name text default '', created_at timestamptz default '2026-01-01');
    create table public.offers(id uuid primary key, store_id uuid, name text, payt_product_code text unique);
    create table public.orders(id uuid primary key default gen_random_uuid(), store_id uuid, payt_transaction_id text, payt_product_code text, payt_product_name text default '', customer_email text, customer_name text default '', status text, status_rank smallint, source text default 'payt', is_test boolean default false, paid_at timestamptz, amount_cents int, note text default '', created_by text default '');
    create table public.payt_events(id uuid primary key default gen_random_uuid(), customer_email text, payload jsonb default '{}', received_at timestamptz default now());
    create table public.login_attempts(id bigint generated always as identity, ip text, email_hash text, store_id uuid, created_at timestamptz default now());
    create table public.email_log(customer_id uuid references public.customers on delete cascade, to_email text, created_at timestamptz default now());
    create table public.customer_devices(customer_id uuid references public.customers on delete cascade);
    create table public.item_access(customer_id uuid references public.customers on delete cascade);
    create table public.member_progress(customer_id uuid references public.customers on delete cascade);
    insert into auth.users values ('${customer}','old@example.test'),('${other}','other@example.test');
    insert into public.customers(id,email) select * from auth.users;
    insert into public.offers values ('${offer}','${store}','Oferta','PAYT-1');
    insert into public.payt_events(customer_email,payload) values ('old@example.test','{"test":true}');
    insert into public.login_attempts(ip,email_hash,store_id) values ('1.1.1.1','old-hash','${store}');
  `)
  await db.exec(migration('20260922210000_admin_atomic_mutations'))
  await db.exec(migration('20260924030000_delete_offer'))
  await db.exec(migration('20260924040000_delete_customer'))
  await db.exec(migration('20260924050000_deletion_integrity'))
  return db
}
const remove = (db: PGlite, email = 'old@example.test', hash = 'old-hash') => db.query('select public.delete_customer_atomic($1,$2,$3::text[],$4)', [customer, email, ['admin@example.test'], hash])
const grant = (db: PGlite, id = customer, offerId = offer, storeId = store) => db.query('select public.create_manual_order_atomic($1,$2,$3,$4,$5)', [storeId, offerId, id, 'admin@example.test', 'Ajuste'])
const change = async (db: PGlite, from: string, to: string, hash: string) => {
  await db.query('update auth.users set email=$1 where id=$2', [to, customer])
  await db.query('select public.change_customer_email_tracked_atomic($1,$2,$3,$4)', [customer, from, to, hash])
}

describe('integridade entre liberação, histórico e exclusão', () => {
  it('libera usando dados atuais e deixa oferta protegida por pedido', async () => {
    const db = await setup(); await grant(db)
    expect((await db.query('select customer_email,source,status,created_by,note,amount_cents from public.orders')).rows).toEqual([{ customer_email: 'old@example.test', source: 'manual', status: 'pago', created_by: 'admin@example.test', note: 'Ajuste', amount_cents: 0 }])
    await expect(db.query('select public.delete_offer_atomic($1,$2,$3)', [offer, store, 'Oferta'])).rejects.toThrow(/pedidos/)
    await remove(db)
    expect((await db.query('select * from public.orders')).rows).toEqual([])
  })
  it('recusa liberação iniciada antes de excluir cliente, mesmo se e-mail for reutilizado', async () => {
    const db = await setup(); await remove(db)
    await db.query("update public.customers set email='old@example.test' where id=$1", [other])
    await expect(grant(db)).rejects.toThrow(/Cliente não encontrado/)
    expect((await db.query('select * from public.orders')).rows).toEqual([])
  })
  it('recusa oferta excluída ou de outra loja', async () => {
    const db = await setup()
    await expect(grant(db, customer, offer, other)).rejects.toThrow(/Oferta/)
    await db.query('select public.delete_offer_atomic($1,$2,$3)', [offer, store, 'Oferta'])
    await expect(grant(db)).rejects.toThrow(/Oferta/)
    expect((await db.query('select * from public.orders')).rows).toEqual([])
  })
  it('bloqueia INSERT manual legado que tenta concluir após exclusão', async () => {
    const db = await setup(); await remove(db)
    await expect(db.query("insert into public.orders(store_id,customer_email,payt_product_code,source,status) values ($1,'old@example.test','PAYT-1','manual','pago')", [store])).rejects.toThrow(/Cliente/)
  })
  it('remove eventos sem pedido e tentativas anteriores após duas trocas de e-mail', async () => {
    const db = await setup()
    await change(db, 'old@example.test', 'middle@example.test', 'old-hash')
    await db.query("insert into public.payt_events(payload) values ('{\"customer\":{\"email\":\"middle@example.test\"}}')")
    await db.query('select public.record_login_attempt_atomic($1,$2,$3,$4)', ['1.1.1.1', 'middle-hash', store, 'middle@example.test'])
    await change(db, 'middle@example.test', 'new@example.test', 'middle-hash')
    await remove(db, 'new@example.test', 'new-hash')
    expect((await db.query('select * from public.payt_events')).rows).toEqual([])
    expect((await db.query('select * from public.login_attempts')).rows).toEqual([])
  })
  it('corrige o e-mail de pedidos manuais existentes e libera novos pelo endereço atual', async () => {
    const db = await setup(); await grant(db)
    await change(db, 'old@example.test', 'new@example.test', 'old-hash')
    await grant(db)
    expect((await db.query('select distinct customer_email from public.orders')).rows).toEqual([{ customer_email: 'new@example.test' }])
  })
  it('preserva histórico da nova conta que reutiliza o e-mail antigo', async () => {
    const db = await setup(); await change(db, 'old@example.test', 'new@example.test', 'old-hash')
    await db.query("update public.customers set email='old@example.test' where id=$1", [other])
    await db.query("insert into public.payt_events(customer_email) values ('old@example.test')")
    await db.query('select public.record_login_attempt_atomic($1,$2,$3,$4)', ['2.2.2.2', 'old-hash', store, 'old@example.test'])
    await remove(db, 'new@example.test', 'new-hash')
    expect((await db.query('select customer_id from public.payt_events')).rows).toEqual([{ customer_id: other }])
    expect((await db.query('select customer_id from public.login_attempts')).rows).toEqual([{ customer_id: other }])
  })
  it('não reatribui evento antigo quando o resumo é atualizado após troca de e-mail', async () => {
    const db = await setup(); await change(db, 'old@example.test', 'new@example.test', 'old-hash')
    await db.query("update public.customers set email='old@example.test' where id=$1", [other])
    await db.exec("update public.payt_events set customer_email='old@example.test'")
    expect((await db.query('select customer_id from public.payt_events')).rows).toEqual([{ customer_id: customer }])
  })
  it('mantém tentativas anônimas sem inventar cliente', async () => {
    const db = await setup()
    await db.query('select public.record_login_attempt_atomic($1,$2,$3,$4)', ['2.2.2.2', null, store, null])
    expect((await db.query("select customer_id from public.login_attempts where ip='2.2.2.2'")).rows).toEqual([{ customer_id: null }])
  })
  it('falha na correção desfaz vinculação e preserva identidade antiga', async () => {
    const db = await setup()
    await expect(change(db, 'old@example.test', 'other@example.test', 'old-hash')).rejects.toThrow()
    expect((await db.query("select customer_id from public.login_attempts where email_hash='old-hash'")).rows).toEqual([{ customer_id: null }])
    expect((await db.query('select email from public.customers where id=$1', [customer])).rows).toEqual([{ email: 'old@example.test' }])
  })
  it('nega funções novas a anon e authenticated', async () => {
    const db = await setup()
    for (const signature of ['create_manual_order_atomic(uuid,uuid,uuid,text,text)','record_login_attempt_atomic(text,text,uuid,text)','change_customer_email_tracked_atomic(uuid,text,text,text)']) {
      expect((await db.query(`select has_function_privilege('anon',$1,'execute') a, has_function_privilege('authenticated',$1,'execute') u, has_function_privilege('service_role',$1,'execute') s`, [`public.${signature}`])).rows).toEqual([{ a: false, u: false, s: true }])
    }
  })
})
