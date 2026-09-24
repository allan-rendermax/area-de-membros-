import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const migration = fileURLToPath(new URL('../../supabase/migrations/20260924010000_product_access_levels.sql', import.meta.url))
const previous = fileURLToPath(new URL('../../supabase/migrations/20260922210000_admin_atomic_mutations.sql', import.meta.url))
const storeA = '00000000-0000-4000-8000-000000000001'
const storeB = '00000000-0000-4000-8000-000000000002'
const offer = '00000000-0000-4000-8000-000000000010'
const productA = '00000000-0000-4000-8000-000000000101'
const productB = '00000000-0000-4000-8000-000000000102'
const foreign = '00000000-0000-4000-8000-000000000201'
const dbs: PGlite[] = []
afterEach(async () => { await Promise.all(dbs.splice(0).map((db) => db.close())) })

async function setup() {
  const db = new PGlite()
  dbs.push(db)
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.stores (id uuid primary key);
    create table public.products (id uuid primary key, store_id uuid not null references public.stores(id));
    create table public.modules (id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id));
    create table public.offers (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), name text not null, payt_product_code text not null unique);
    create table public.offer_products (offer_id uuid not null references public.offers(id), product_id uuid not null references public.products(id), primary key (offer_id, product_id));
    create table public.customers (id uuid primary key, email text not null unique);
    create table public.orders (id uuid primary key default gen_random_uuid(), customer_email text not null);
    create schema storage;
    create table storage.buckets (id text primary key, name text not null, public boolean not null);
    insert into public.stores values ('${storeA}'), ('${storeB}');
    insert into public.products values ('${productA}','${storeA}'), ('${productB}','${storeA}'), ('${foreign}','${storeB}');
    insert into public.offers values ('${offer}','${storeA}','Original','CODE');
    insert into public.offer_products values ('${offer}','${productA}');
    insert into public.modules (product_id) values ('${productA}');
  `)
  await db.exec(readFileSync(previous, 'utf8'))
  await db.exec(readFileSync(migration, 'utf8'))
  return db
}

async function save(db: PGlite, id: string | null, store: string, code: string, grants: unknown) {
  return db.query('select public.save_offer_levels_atomic($1::uuid,$2::uuid,$3::text,$4::text,$5::jsonb) as id', [id, store, 'Changed', code, JSON.stringify(grants)])
}

async function state(db: PGlite) {
  const rows = await db.query<{ name: string; product_id: string; grant_level: string }>(`
    select o.name, op.product_id, op.grant_level from public.offers o
    join public.offer_products op on op.offer_id=o.id where o.id='${offer}' order by op.product_id`)
  return rows.rows
}

describe('product access migration', () => {
  it('defaults existing grants to complete and modules to basic', async () => {
    const db = await setup()
    expect((await state(db))[0].grant_level).toBe('complete')
    const moduleRows = await db.query<{ required_level: string }>('select required_level from public.modules')
    expect(moduleRows.rows[0].required_level).toBe('basic')
    await expect(db.exec(`update public.offer_products set grant_level='other'`)).rejects.toThrow()
    await expect(db.exec(`update public.modules set required_level=null`)).rejects.toThrow()
    const bucket = await db.query<{ public: boolean }>(`select public from storage.buckets where id='arquivos-restritos'`)
    expect(bucket.rows[0].public).toBe(false)
  })

  it('saves levels and preserves basic when legacy wrapper reselects the product', async () => {
    const db = await setup()
    await save(db, offer, storeA, 'CODE', [{ product_id: productA, grant_level: 'basic' }])
    await db.query('select public.save_offer_atomic($1::uuid,$2::uuid,$3::text,$4::text,$5::uuid[])', [offer, storeA, 'Legacy edit', 'CODE', [productA, productB]])
    expect((await state(db)).map((r) => [r.product_id, r.grant_level])).toEqual([[productA, 'basic'], [productB, 'complete']])
  })

  it('locks the existing offer before reading links in the legacy wrapper', async () => {
    const db = await setup()
    const result = await db.query<{ definition: string }>(`
      select pg_get_functiondef('public.save_offer_atomic(uuid,uuid,text,text,uuid[])'::regprocedure) as definition`)
    const definition = result.rows[0].definition.toLowerCase()
    const lockAt = definition.indexOf('for update;')
    const levelsAt = definition.indexOf('select coalesce(jsonb_agg')
    expect(lockAt).toBeGreaterThan(0)
    expect(levelsAt).toBeGreaterThan(lockAt)
    await expect(db.query('select public.save_offer_atomic($1::uuid,$2::uuid,$3::text,$4::text,$5::uuid[])',
      [offer, storeB, 'Wrong store', 'CODE', [productA]])).rejects.toThrow()
    expect(await state(db)).toEqual([{ name: 'Original', product_id: productA, grant_level: 'complete' }])
  })

  it('rejects invalid levels, conflicts, wrong store and changed code without partial writes', async () => {
    const db = await setup()
    for (const [store, code, grants] of [
      [storeA, 'CODE', [{ product_id: productA, grant_level: 'other' }]],
      [storeA, 'CODE', [{ product_id: productA, grant_level: 'basic' }, { product_id: productA, grant_level: 'complete' }]],
      [storeA, 'CODE', [{ product_id: foreign, grant_level: 'basic' }]],
      [storeB, 'CODE', [{ product_id: productA, grant_level: 'basic' }]],
      [storeA, 'NEW', [{ product_id: productA, grant_level: 'basic' }]],
    ] as [string, string, unknown][]) {
      await expect(save(db, offer, store, code, grants)).rejects.toThrow()
      expect(await state(db)).toEqual([{ name: 'Original', product_id: productA, grant_level: 'complete' }])
    }
  })

  it('rolls back offer edits when link insertion fails and limits execution to service role', async () => {
    const db = await setup()
    await db.exec(`create function public.reject_link() returns trigger language plpgsql as $$ begin if new.product_id='${productB}'::uuid then raise exception 'link rejected'; end if; return new; end $$;
      create trigger reject_link before insert on public.offer_products for each row execute function public.reject_link();`)
    await expect(save(db, offer, storeA, 'CODE', [{ product_id: productB, grant_level: 'basic' }])).rejects.toThrow('link rejected')
    expect(await state(db)).toEqual([{ name: 'Original', product_id: productA, grant_level: 'complete' }])
    const sig = 'public.save_offer_levels_atomic(uuid,uuid,text,text,jsonb)'
    const privilege = await db.query<{ anon: boolean; authenticated: boolean; service_role: boolean }>(`
      select has_function_privilege('anon','${sig}','EXECUTE') as anon,
             has_function_privilege('authenticated','${sig}','EXECUTE') as authenticated,
             has_function_privilege('service_role','${sig}','EXECUTE') as service_role`)
    expect(privilege.rows[0]).toEqual({ anon: false, authenticated: false, service_role: true })
  })
})
