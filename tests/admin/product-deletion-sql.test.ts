import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const migration = fileURLToPath(new URL('../../supabase/migrations/20260924020000_delete_product.sql', import.meta.url))
const store = '00000000-0000-4000-8000-000000000001'
const otherStore = '00000000-0000-4000-8000-000000000002'
const product = '00000000-0000-4000-8000-000000000101'
const otherProduct = '00000000-0000-4000-8000-000000000102'
const offer = '00000000-0000-4000-8000-000000000201'
const moduleId = '00000000-0000-4000-8000-000000000301'
const item = '00000000-0000-4000-8000-000000000401'
const dbs: PGlite[] = []
afterEach(async () => { await Promise.all(dbs.splice(0).map(db => db.close())) })

async function setup() {
  const db = new PGlite()
  dbs.push(db)
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.products (id uuid primary key, store_id uuid not null, title text not null);
    create table public.modules (id uuid primary key, product_id uuid references public.products(id) on delete cascade);
    create table public.items (id uuid primary key, module_id uuid references public.modules(id) on delete cascade, url text);
    create table public.offers (id uuid primary key, payt_product_code text);
    create table public.offer_products (offer_id uuid references public.offers(id), product_id uuid references public.products(id) on delete cascade);
    create table public.orders (id int primary key, status text, payt_product_code text);
    create table public.item_access (product_id uuid references public.products(id) on delete cascade, item_id uuid references public.items(id) on delete cascade);
    create table public.member_progress (product_id uuid references public.products(id) on delete cascade, item_id uuid references public.items(id) on delete cascade);
    create table public.email_log (id int primary key, product_ids uuid[] not null default '{}');
    create schema storage; create table storage.objects (name text primary key);
    insert into public.products values ('${product}','${store}','Produto de teste'), ('${otherProduct}','${otherStore}','Outro produto');
    insert into public.modules values ('${moduleId}','${product}');
    insert into public.items values ('${item}','${moduleId}','https://example.test/shared.pdf');
    insert into public.offers values ('${offer}','PAYT');
    insert into public.orders values (1,'pago','OTHER');
    insert into storage.objects values ('shared.pdf');
  `)
  await db.exec(readFileSync(migration, 'utf8'))
  return db
}

async function remove(db: PGlite, storeId = store, name: string | null = 'Produto de teste', id = product) {
  return db.query('select public.delete_product_atomic($1::uuid,$2::uuid,$3::text)', [id, storeId, name])
}
async function ids(db: PGlite, table: string) {
  return (await db.query<{ id: string }>(`select id from public.${table} order by id`)).rows.map(row => row.id)
}

describe('exclusão atômica de produto', () => {
  it('remove produto, módulos e itens sem apagar outros produtos, pedidos ou arquivos', async () => {
    const db = await setup()
    await remove(db)
    expect(await ids(db, 'products')).toEqual([otherProduct])
    expect(await ids(db, 'modules')).toEqual([])
    expect(await ids(db, 'items')).toEqual([])
    expect((await db.query('select * from public.orders')).rows).toEqual([{ id: 1, status: 'pago', payt_product_code: 'OTHER' }])
    expect((await db.query('select * from storage.objects')).rows).toEqual([{ name: 'shared.pdf' }])
  })

  it('recusa vínculo com oferta mesmo sem compra e mantém todos os registros', async () => {
    const db = await setup()
    await db.exec(`insert into public.offer_products values ('${offer}','${product}')`)
    await expect(remove(db)).rejects.toThrow(/oferta/i)
    expect(await ids(db, 'products')).toEqual([product, otherProduct])
    expect(await ids(db, 'modules')).toEqual([moduleId])
    expect(await ids(db, 'items')).toEqual([item])
    expect((await db.query('select * from public.offer_products')).rows).toHaveLength(1)
  })

  it.each(['item_access', 'member_progress', 'email_log'])('preserva histórico em %s mesmo após desvincular ofertas', async table => {
    const db = await setup()
    await db.exec(table === 'email_log'
      ? `insert into public.email_log values (1, array['${product}']::uuid[])`
      : `insert into public.${table} values ('${product}', '${item}')`)
    await expect(remove(db)).rejects.toThrow(/histórico/i)
    expect(await ids(db, 'products')).toContain(product)
    expect(await ids(db, 'items')).toEqual([item])
    expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(1)
  })

  it('recusa produto de outra loja, ausente e repetição da exclusão', async () => {
    const db = await setup()
    await expect(remove(db, otherStore)).rejects.toThrow(/não encontrado/i)
    expect(await ids(db, 'products')).toEqual([product, otherProduct])
    await remove(db)
    await expect(remove(db)).rejects.toThrow(/não encontrado/i)
    expect(await ids(db, 'products')).toEqual([otherProduct])
  })

  it('recusa aviso preparado antes mas registrado após excluir o produto', async () => {
    const db = await setup()
    await remove(db)
    await expect(db.query('insert into public.email_log values (1, $1::uuid[])', [[product]]))
      .rejects.toThrow(/produto.*não existe/i)
    expect(await ids(db, 'email_log')).toEqual([])
  })

  it('valida todos os produtos ao registrar aviso e preserva o log se uma alteração for inválida', async () => {
    const db = await setup()
    await db.query('insert into public.email_log values (1, $1::uuid[])', [[otherProduct]])
    await remove(db)
    await expect(db.query('update public.email_log set product_ids=$1::uuid[] where id=1', [[otherProduct, product]]))
      .rejects.toThrow(/produto.*não existe/i)
    expect((await db.query('select product_ids from public.email_log')).rows).toEqual([{ product_ids: [otherProduct] }])
  })

  it('aceita avisos sem produtos e múltiplos produtos existentes, protegendo os referenciados', async () => {
    const db = await setup()
    await db.exec('insert into public.email_log values (1, array[]::uuid[])')
    await db.query('insert into public.email_log values (2, $1::uuid[])', [[otherProduct, product, product]])
    await expect(remove(db)).rejects.toThrow(/histórico/i)
    expect((await db.query('select count(*)::int as count from public.email_log')).rows).toEqual([{ count: 2 }])
  })

  it.each(['', null, 'Outro produto', 'produto de teste'])('exige confirmação do nome atual: %s', async name => {
    const db = await setup()
    await expect(remove(db, store, name)).rejects.toThrow(/nome/i)
    expect(await ids(db, 'products')).toContain(product)
  })

  it('rejeita confirmação de uma página anterior à renomeação', async () => {
    const db = await setup()
    await db.exec(`update public.products set title='Nome novo' where id='${product}'`)
    await expect(remove(db)).rejects.toThrow(/nome/i)
    expect(await ids(db, 'products')).toContain(product)
  })

  it('nega execução a anon e authenticated e permite service_role', async () => {
    const db = await setup()
    const result = await db.query<{ role: string; allowed: boolean }>(`select rolname as role,
      has_function_privilege(rolname, 'public.delete_product_atomic(uuid,uuid,text)', 'execute') as allowed
      from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname`)
    expect(result.rows).toEqual([{ role: 'anon', allowed: false }, { role: 'authenticated', allowed: false }, { role: 'service_role', allowed: true }])
  })
})
