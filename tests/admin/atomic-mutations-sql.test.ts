import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const migration = fileURLToPath(new URL('../../supabase/migrations/20260922210000_admin_atomic_mutations.sql', import.meta.url))
const storeA = '00000000-0000-4000-8000-000000000001'
const storeB = '00000000-0000-4000-8000-000000000002'
const offer = '00000000-0000-4000-8000-000000000010'
const productA = '00000000-0000-4000-8000-000000000101'
const productB = '00000000-0000-4000-8000-000000000102'
const foreignProduct = '00000000-0000-4000-8000-000000000201'
const customer = '00000000-0000-4000-8000-000000000301'
const dbs: PGlite[] = []
afterEach(async () => { await Promise.all(dbs.splice(0).map((db) => db.close())) })

async function setup() {
  const db = new PGlite()
  dbs.push(db)
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.stores (id uuid primary key);
    create table public.products (id uuid primary key, store_id uuid not null references public.stores(id));
    create table public.offers (id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), name text not null, payt_product_code text not null unique);
    create table public.offer_products (offer_id uuid not null references public.offers(id), product_id uuid not null references public.products(id), primary key (offer_id, product_id));
    create table public.customers (id uuid primary key, email text not null unique);
    create table public.orders (id uuid primary key default gen_random_uuid(), customer_email text not null);
    insert into public.stores values ('${storeA}'), ('${storeB}');
    insert into public.products values ('${productA}','${storeA}'), ('${productB}','${storeA}'), ('${foreignProduct}','${storeB}');
    insert into public.offers values ('${offer}','${storeA}','Original','CODE');
    insert into public.offer_products values ('${offer}','${productA}');
    insert into public.customers values ('${customer}','old@example.com');
    insert into public.orders (customer_email) values ('old@example.com');
  `)
  await db.exec(readFileSync(migration, 'utf8'))
  return db
}

async function save(db: PGlite, id: string | null, store: string, code: string, ids: string[]) {
  return db.query(`select public.save_offer_atomic($1::uuid,$2::uuid,$3::text,$4::text,$5::uuid[])`, [id, store, 'Changed', code, ids])
}
async function state(db: PGlite) {
  const names = await db.query<{ name: string }>(`select name from public.offers where id='${offer}'`)
  const links = await db.query<{ product_id: string }>(`select product_id from public.offer_products where offer_id='${offer}' order by product_id`)
  return { name: names.rows[0].name, ids: links.rows.map((r) => r.product_id) }
}

describe('RPCs administrativas', () => {
  it('substitui seleção inteira e normaliza ids duplicados', async () => {
    const db = await setup()
    await save(db, offer, storeA, 'CODE', [productB, productB])
    expect(await state(db)).toEqual({ name: 'Changed', ids: [productB] })
  })
  it('preserva oferta ao recusar vazio, outra loja, id ausente e código alterado', async () => {
    const db = await setup()
    for (const [id, store, code, ids] of [
      [offer, storeA, 'CODE', []], [offer, storeA, 'CODE', [foreignProduct]],
      [offer, storeB, 'CODE', [productA]], [offer, storeA, 'NEW', [productA]],
      ['00000000-0000-4000-8000-000000000099', storeA, 'CODE', [productA]],
    ] as [string, string, string, string[]][]) {
      await expect(save(db, id, store, code, ids)).rejects.toThrow()
      expect(await state(db)).toEqual({ name: 'Original', ids: [productA] })
    }
  })
  it('não deixa oferta nova sem vínculos em erro de FK', async () => {
    const db = await setup()
    await expect(save(db, null, storeA, 'NEW', ['00000000-0000-4000-8000-000000000999'])).rejects.toThrow()
    const count = await db.query<{ count: number }>(`select count(*)::int as count from public.offers where payt_product_code='NEW'`)
    expect(count.rows[0].count).toBe(0)
  })
  it('restaura nome e vínculos se inserção posterior falhar', async () => {
    const db = await setup()
    await db.exec(`
      create function public.reject_offer_link() returns trigger language plpgsql as $$
      begin
        if new.product_id = '${productB}'::uuid then raise exception 'link rejected'; end if;
        return new;
      end $$;
      create trigger reject_link before insert on public.offer_products
      for each row execute function public.reject_offer_link();
    `)
    await expect(save(db, offer, storeA, 'CODE', [productB])).rejects.toThrow('link rejected')
    expect(await state(db)).toEqual({ name: 'Original', ids: [productA] })
  })
  it('altera cliente e pedidos juntos e respeita email esperado', async () => {
    const db = await setup()
    await expect(db.query(`select public.change_customer_email_atomic($1::uuid,$2::text,$3::text)`, [customer, 'wrong@example.com', 'new@example.com'])).rejects.toThrow()
    await db.query(`select public.change_customer_email_atomic($1::uuid,$2::text,$3::text)`, [customer, 'old@example.com', 'new@example.com'])
    const rows = await db.query<{ email: string }>(`select email from public.customers union all select customer_email from public.orders`)
    expect(rows.rows.map((r) => r.email)).toEqual(['new@example.com', 'new@example.com'])
  })
  it('reverte pedidos se unicidade do email do cliente falha', async () => {
    const db = await setup()
    await db.exec(`insert into public.customers values ('00000000-0000-4000-8000-000000000302','taken@example.com')`)
    await expect(db.query(`select public.change_customer_email_atomic($1::uuid,$2::text,$3::text)`, [customer, 'old@example.com', 'taken@example.com'])).rejects.toThrow()
    const rows = await db.query<{ email: string }>(`select email from public.customers where id='${customer}' union all select customer_email from public.orders`)
    expect(rows.rows.map((r) => r.email)).toEqual(['old@example.com', 'old@example.com'])
  })
  it('restringe execução ao service_role, usa invoker e search_path fixo', async () => {
    const db = await setup()
    for (const signature of [
      'public.save_offer_atomic(uuid,uuid,text,text,uuid[])',
      'public.change_customer_email_atomic(uuid,text,text)',
    ]) {
      const result = await db.query<{ anon: boolean; authenticated: boolean; service_role: boolean; definer: boolean; settings: string[] }>(`
        select has_function_privilege('anon', '${signature}', 'EXECUTE') as anon,
               has_function_privilege('authenticated', '${signature}', 'EXECUTE') as authenticated,
               has_function_privilege('service_role', '${signature}', 'EXECUTE') as service_role,
               p.prosecdef as definer, p.proconfig as settings
          from pg_proc p where p.oid='${signature}'::regprocedure`)
      expect(result.rows[0]).toEqual({ anon: false, authenticated: false, service_role: true, definer: false, settings: ['search_path=""'] })
      await db.exec('set role anon')
      await expect(db.query(`select ${signature.startsWith('public.save') ? 'public.save_offer_atomic(null,null,null,null,null)' : 'public.change_customer_email_atomic(null,null,null)'}`)).rejects.toThrow('permission denied')
      await db.exec('reset role')
    }
  })
})
