import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const migration = fileURLToPath(new URL('../../supabase/migrations/20260924000003_product_role.sql', import.meta.url))
const dbs: PGlite[] = []
afterEach(async () => { await Promise.all(dbs.splice(0).map((db) => db.close())) })

it('migra produtos anteriores para front e restringe novos papéis', async () => {
  const db = new PGlite()
  dbs.push(db)
  await db.exec("create table public.products (id int primary key); insert into public.products values (1)")
  await db.exec(readFileSync(migration, 'utf8'))
  const existing = await db.query<{ role: string }>('select role from public.products where id = 1')
  expect(existing.rows[0].role).toBe('front')
  await db.exec("insert into public.products (id, role) values (2, 'orderbump'), (3, 'upsell'), (4, default)")
  const roles = await db.query<{ role: string }>('select role from public.products order by id')
  expect(roles.rows.map((row) => row.role)).toEqual(['front', 'orderbump', 'upsell', 'front'])
  await expect(db.exec("insert into public.products (id, role) values (5, 'other')")).rejects.toThrow()
  await expect(db.exec('insert into public.products (id, role) values (6, null)')).rejects.toThrow()
})

it('pode ser aplicada novamente quando a coluna foi criada manualmente', async () => {
  const db = new PGlite()
  dbs.push(db)
  await db.exec("create table public.products (id int primary key, role text not null default 'front'); insert into public.products values (1)")
  const sql = readFileSync(migration, 'utf8')
  await db.exec(sql)
  await db.exec(sql)
  await expect(db.exec("insert into public.products (id, role) values (2, 'other')")).rejects.toThrow()
})
