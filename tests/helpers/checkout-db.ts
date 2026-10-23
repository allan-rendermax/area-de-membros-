import { existsSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterEach } from 'vitest'

export const store = '00000000-0000-4000-8000-000000000001'
export const otherStore = '00000000-0000-4000-8000-000000000002'
export const product = '00000000-0000-4000-8000-000000000101'
export const customer = '00000000-0000-4000-8000-000000000301'
const dbs: PGlite[] = []
afterEach(async () => { await Promise.all(dbs.splice(0).map(db => db.close())) })
const sql = (file: string) => readFileSync(new URL(`../../supabase/migrations/${file}.sql`, import.meta.url), 'utf8')
export async function setup() {
  const db = new PGlite(); dbs.push(db)
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema storage; create table storage.buckets (id text primary key, name text, public boolean);
    create table stores (id uuid primary key);
    create table products (id uuid primary key, store_id uuid references stores(id), title text);
    create table modules (id uuid primary key);
    create table customers (id uuid primary key, email text unique);
    create table customer_devices (customer_id uuid, last_seen_at timestamptz);
    create table item_access (customer_id uuid, store_id uuid, created_at timestamptz);
    create table offers (id uuid primary key default gen_random_uuid(), store_id uuid not null references stores(id), name text not null, payt_product_code text not null constraint offers_payt_product_code_key unique);
    create table offer_products (offer_id uuid references offers(id) on delete cascade, product_id uuid references products(id), primary key(offer_id, product_id));
    create table orders (
      id uuid primary key default gen_random_uuid(), store_id uuid, payt_transaction_id text not null, payt_product_code text not null,
      payt_product_name text default '', customer_email text not null, customer_name text default '', status text not null,
      status_rank smallint not null, payt_type text default 'order', is_test boolean default false, amount_cents integer,
      paid_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now(), source text default 'payt',
      note text default '', created_by text default '', unique(payt_transaction_id,payt_product_code));
    insert into stores values ('${store}'), ('${otherStore}');
    insert into products values ('${product}', '${store}', 'Atlas');
    insert into customers values ('${customer}', 'a@example.test');
    insert into offers(store_id,name,payt_product_code) values ('${store}', 'Legacy', 'LEGACY');
  `)
  await db.exec(sql('20260924010000_product_access_levels'))
  await db.exec(sql('20260924030000_delete_offer'))
  await db.exec(sql('20260925030000_offer_groups'))
  await db.exec(sql('20260922150000_order_payment_identity'))
  const path = new URL('../../supabase/migrations/20261023010000_checkout_plans.sql', import.meta.url)
  if (existsSync(path)) await db.exec(readFileSync(path, 'utf8'))
  return db
}
export const plans = [
  { name: 'Basic', payt_product_code: 'SHARED', match_type: 'checkout', checkout_code: 'REF-B', match_values: ['https://payt.site/Basic', 'https://checkout.payt.com.br/basic'], grants: [{ product_id: product, grant_level: 'basic' }] },
  { name: 'Full', payt_product_code: 'SHARED', match_type: 'checkout', checkout_code: 'REF-F', match_values: ['https://payt.site/Full'], grants: [{ product_id: product, grant_level: 'complete' }] },
  { name: 'Upsell', payt_product_code: 'SHARED', match_type: 'upsell', match_values: ['UP'], grants: [{ product_id: product, grant_level: 'complete' }] },
]
export async function save(db: PGlite, input: unknown[] = plans, groupId: string | null = null, storeId = store) {
  const version = groupId ? (await db.query<{version:number}>('select version from offer_groups where id=$1',[groupId])).rows[0].version : null
  return (await db.query<{id:string}>('select save_offer_group_atomic($1,$2,$3,$4,$5::jsonb) as id', [groupId,storeId,'Plans',version,JSON.stringify(input)])).rows[0].id
}
export async function apply(db: PGlite, opts: { tx?:string; code?:string; status?:string; url?:string|null; upsell?:string|null; email?:string; storeId?:string|null } = {}) {
  return (await db.query<{
    out_order_id:string; out_offer_id:string|null; out_changed:boolean; out_status:string; out_customer_email:string; out_identification_warning:string|null;
  }>('select * from apply_payt_order_status($1,$2,$3,$4,$5,$6,$7,$8::smallint,$9,$10,$11,$12,$13,$14)',
    [opts.storeId === undefined ? store : opts.storeId,opts.tx??'TX',opts.code??'SHARED','Atlas',opts.email??'a@example.test','A',opts.status??'pago',opts.status==='pendente'?0:!opts.status||opts.status==='pago'?1:2,'order',false,100,opts.url??null,opts.upsell??null,false])).rows[0]
}
