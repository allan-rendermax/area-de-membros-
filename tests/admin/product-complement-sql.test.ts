import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const migration = fileURLToPath(new URL('../../supabase/migrations/20261021010000_product_complement.sql', import.meta.url))
const dbs: PGlite[] = []
afterEach(async () => { await Promise.all(dbs.splice(0).map(db => db.close())) })

it('aceita somente complemento da mesma loja, limpa ao excluir alvo e aplica seed limitado', async () => {
  const db = new PGlite(); dbs.push(db)
  await db.exec(`create schema if not exists public; create table public.stores(id uuid primary key, slug text unique);
    create table public.products(id uuid primary key, store_id uuid not null references public.stores(id) on delete cascade, slug text not null);
    insert into public.stores values ('00000000-0000-0000-0000-000000000001','arquitetura'),('00000000-0000-0000-0000-000000000002','outra');
    insert into public.products values
    ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','atlas-visual-das-patologias-na-construcao-civil-completo'),
    ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','protocolo-anti-retrabalho'),
    ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000001','outro'),
    ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002','atlas-visual-das-patologias-na-construcao-civil-completo');`)
  const sql = readFileSync(migration, 'utf8')
  await db.exec(sql)
  const ids = await db.query<{ slug: string; complementary_product_id: string | null }>('select slug, complementary_product_id from public.products order by id')
  expect(ids.rows.map(row => row.complementary_product_id)).toEqual(['00000000-0000-0000-0000-000000000012', null, null, null])
  await db.exec("update public.products set complementary_product_id = '00000000-0000-0000-0000-000000000013' where id = '00000000-0000-0000-0000-000000000011'")
  await db.exec(sql.slice(sql.indexOf('update public.products as source')))
  const chosen = await db.query<{ complementary_product_id: string }>("select complementary_product_id from public.products where id = '00000000-0000-0000-0000-000000000011'")
  expect(chosen.rows[0].complementary_product_id).toBe('00000000-0000-0000-0000-000000000013')
  await expect(db.exec("update public.products set complementary_product_id = '00000000-0000-0000-0000-000000000021' where id = '00000000-0000-0000-0000-000000000011'")).rejects.toThrow()
  await expect(db.exec("update public.products set complementary_product_id = id where id = '00000000-0000-0000-0000-000000000011'")).rejects.toThrow()
  await db.exec("delete from public.products where id = '00000000-0000-0000-0000-000000000013'")
  const source = await db.query<{ complementary_product_id: string | null }>("select complementary_product_id from public.products where id = '00000000-0000-0000-0000-000000000011'")
  expect(source.rows[0]?.complementary_product_id).toBeNull()
})

async function linkedProductsDb(): Promise<PGlite> {
  const db = new PGlite(); dbs.push(db)
  await db.exec(`create schema if not exists public;
    create table public.stores(id uuid primary key, slug text unique);
    create table public.products(id uuid primary key, store_id uuid not null references public.stores(id) on delete cascade, slug text not null);
    insert into public.stores values ('00000000-0000-0000-0000-000000000001', 'loja');
    insert into public.products values
      ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'origem'),
      ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'alvo');`)
  await db.exec(readFileSync(migration, 'utf8'))
  await db.exec("update public.products set complementary_product_id = '00000000-0000-0000-0000-000000000012' where id = '00000000-0000-0000-0000-000000000011'")
  return db
}

it('excluir a origem preserva o produto alvo', async () => {
  const db = await linkedProductsDb()
  await db.exec("delete from public.products where id = '00000000-0000-0000-0000-000000000011'")
  const products = await db.query<{ slug: string; complementary_product_id: string | null }>('select slug, complementary_product_id from public.products order by slug')
  expect(products.rows).toEqual([{ slug: 'alvo', complementary_product_id: null }])
})

it('excluir a loja remove origem e alvo associados', async () => {
  const db = await linkedProductsDb()
  await db.exec("delete from public.stores where id = '00000000-0000-0000-0000-000000000001'")
  const stores = await db.query('select id from public.stores')
  const products = await db.query('select id from public.products')
  expect(stores.rows).toEqual([])
  expect(products.rows).toEqual([])
})
