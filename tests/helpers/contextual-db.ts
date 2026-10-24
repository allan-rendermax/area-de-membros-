import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterEach } from 'vitest'
const dbs: PGlite[] = []
afterEach(async () => { await Promise.all(dbs.splice(0).map(db => db.close())) })
export const s = '00000000-0000-4000-8000-000000000001'
export const other = '00000000-0000-4000-8000-000000000002'
export const a = '00000000-0000-4000-8000-000000000101'
export const b = '00000000-0000-4000-8000-000000000102'
export const c = '00000000-0000-4000-8000-000000000103'
export const foreign = '00000000-0000-4000-8000-000000000104'
export async function setup() {
  const db = new PGlite(); dbs.push(db)
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table stores(id uuid primary key);
    create table products(id uuid primary key default gen_random_uuid(), store_id uuid not null references stores(id) on delete cascade,
      slug text not null, title text not null, description text not null default '', updated_at timestamptz default now(),
      complementary_product_id uuid, unique(store_id,id), unique(store_id,slug));
    insert into stores values ('${s}'),('${other}');
    insert into products(id,store_id,slug,title) values ('${a}','${s}','a','Atlas'),('${b}','${s}','b','Guia'),('${c}','${s}','c','Outro'),('${foreign}','${other}','f','Outra loja');`)
  for (const file of ['20261024020000_contextual_complements','20261024021000_save_contextual_product']) {
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}.sql`, import.meta.url), 'utf8'))
  }
  return db
}
export async function save(db: PGlite, id: string|null, revision: number|null, patch: object, targets: string[]|null = null) {
  return db.query('select save_contextual_product($1,$2,$3,$4::jsonb,$5::uuid[]) as id',[s,id,revision,JSON.stringify(patch),targets])
}
