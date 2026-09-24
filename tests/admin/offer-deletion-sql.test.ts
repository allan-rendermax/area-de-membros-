import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const migration = fileURLToPath(new URL('../../supabase/migrations/20260924030000_delete_offer.sql', import.meta.url))
const productMigration = fileURLToPath(new URL('../../supabase/migrations/20260924020000_delete_product.sql', import.meta.url))
const store = '00000000-0000-4000-8000-000000000001'
const otherStore = '00000000-0000-4000-8000-000000000002'
const product = '00000000-0000-4000-8000-000000000101'
const offer = '00000000-0000-4000-8000-000000000201'
const otherOffer = '00000000-0000-4000-8000-000000000202'
const dbs: PGlite[] = []
afterEach(async () => { await Promise.all(dbs.splice(0).map(db => db.close())) })

async function setup() {
  const db = new PGlite()
  dbs.push(db)
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.products (id uuid primary key, store_id uuid not null, title text not null);
    create table public.modules (id uuid primary key, product_id uuid references public.products(id) on delete cascade);
    create table public.items (id uuid primary key, module_id uuid references public.modules(id) on delete cascade);
    create table public.offers (id uuid primary key, store_id uuid not null, name text not null, payt_product_code text unique not null);
    create table public.offer_products (offer_id uuid references public.offers(id) on delete cascade, product_id uuid references public.products(id) on delete cascade);
    create table public.orders (id int primary key, store_id uuid, status text, is_test boolean default false, payt_product_code text);
    create table public.item_access (product_id uuid references public.products(id) on delete cascade);
    create table public.member_progress (product_id uuid references public.products(id) on delete cascade);
    create table public.email_log (id int primary key, product_ids uuid[] not null default '{}');
    insert into public.products values ('${product}', '${store}', 'Produto de teste');
    insert into public.offers values ('${offer}', '${store}', 'Oferta de teste', 'PAYT-A'), ('${otherOffer}', '${otherStore}', 'Outra oferta', 'PAYT-B');
    insert into public.offer_products values ('${offer}', '${product}');
    insert into public.orders values (1, '${otherStore}', 'pago', false, 'PAYT-B');
  `)
  await db.exec(readFileSync(productMigration, 'utf8'))
  await db.exec(readFileSync(migration, 'utf8'))
  return db
}
function remove(db: PGlite, storeId = store, confirmation: string | null = 'Oferta de teste', id = offer) {
  return db.query('select public.delete_offer_atomic($1::uuid,$2::uuid,$3::text)', [id, storeId, confirmation])
}

describe('exclusão de oferta sem pedidos', () => {
  it('desfaz o bloqueio circular: remove oferta com único produto e depois permite excluir esse produto', async () => {
    const db = await setup()
    const removeProduct = () => db.query('select public.delete_product_atomic($1::uuid,$2::uuid,$3::text)', [product, store, 'Produto de teste'])
    await expect(removeProduct()).rejects.toThrow(/oferta/i)
    await remove(db)
    expect((await db.query('select id from public.products')).rows).toEqual([{ id: product }])
    expect((await db.query('select * from public.offer_products')).rows).toEqual([])
    expect((await db.query('select id from public.offers')).rows).toEqual([{ id: otherOffer }])
    expect((await db.query('select id from public.orders')).rows).toEqual([{ id: 1 }])
    await removeProduct()
    expect((await db.query('select * from public.products')).rows).toEqual([])
  })

  it.each(['pendente', 'pago', 'cancelado', 'reembolsado', 'chargeback'])('preserva oferta e vínculo com pedido %s', async status => {
    const db = await setup()
    await db.query('insert into public.orders values (2,$1,$2,false,$3)', [store, status, 'PAYT-A'])
    await expect(remove(db)).rejects.toThrow(/pedidos/i)
    expect((await db.query('select * from public.offers where id=$1', [offer])).rows).toHaveLength(1)
    expect((await db.query('select * from public.offer_products')).rows).toHaveLength(1)
    expect((await db.query('select * from public.orders')).rows).toHaveLength(2)
  })

  it('encontra pedidos pelo código global mesmo sem loja e mesmo marcados como teste', async () => {
    const db = await setup()
    await db.exec("insert into public.orders values (2,null,'pago',true,'PAYT-A')")
    await expect(remove(db)).rejects.toThrow(/pedidos/i)
  })

  it('recusa outra loja e repetição sem remover a oferta errada', async () => {
    const db = await setup()
    await expect(remove(db, otherStore)).rejects.toThrow(/não encontrada/i)
    await remove(db)
    await expect(remove(db)).rejects.toThrow(/não encontrada/i)
    expect((await db.query('select id from public.offers')).rows).toEqual([{ id: otherOffer }])
  })

  it.each(['', null, 'Nome errado'])('exige nome atual: %s', async confirmation => {
    const db = await setup()
    await expect(remove(db, store, confirmation)).rejects.toThrow(/nome/i)
    expect((await db.query('select * from public.offer_products')).rows).toHaveLength(1)
  })

  it('não remove vínculos de outras ofertas que continuam protegendo o produto', async () => {
    const db = await setup()
    await db.query('insert into public.offer_products values ($1,$2)', [otherOffer, product])
    await remove(db)
    expect((await db.query('select offer_id from public.offer_products')).rows).toEqual([{ offer_id: otherOffer }])
    await expect(db.query('select public.delete_product_atomic($1::uuid,$2::uuid,$3::text)', [product, store, 'Produto de teste'])).rejects.toThrow(/oferta/i)
  })

  it('mantém histórico de acesso bloqueando o produto mesmo depois de excluir oferta sem pedidos', async () => {
    const db = await setup()
    await db.query('insert into public.item_access values ($1)', [product])
    await remove(db)
    await expect(db.query('select public.delete_product_atomic($1::uuid,$2::uuid,$3::text)', [product, store, 'Produto de teste'])).rejects.toThrow(/histórico/i)
    expect((await db.query('select * from public.item_access')).rows).toHaveLength(1)
  })

  it('restringe a RPC ao service_role', async () => {
    const db = await setup()
    const result = await db.query(`select rolname as role, has_function_privilege(rolname,
      'public.delete_offer_atomic(uuid,uuid,text)', 'execute') as allowed
      from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname`)
    expect(result.rows).toEqual([{ role: 'anon', allowed: false }, { role: 'authenticated', allowed: false }, { role: 'service_role', allowed: true }])
  })
})
