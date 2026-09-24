import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const path = fileURLToPath(new URL('../../supabase/migrations/20260924000001_member_progress.sql', import.meta.url))

describe('migration de progresso', () => {
  it('impõe identidade por aluno/loja/item e mantém RLS sem políticas públicas', async () => {
    const db = new PGlite()
    try {
      await db.exec(`
        create table public.customers(id uuid primary key);
        create table public.stores(id uuid primary key);
        create table public.products(id uuid primary key);
        create table public.items(id uuid primary key);
      `)
      await db.exec(readFileSync(path, 'utf8'))
      const ids = ['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004']
      for (const [table, id] of ['customers','stores','products','items'].map((table, i) => [table, ids[i]])) await db.query(`insert into public.${table}(id) values ($1)`, [id])
      await db.query('insert into public.member_progress(customer_id,store_id,product_id,item_id) values ($1,$2,$3,$4)', ids)
      await expect(db.query('insert into public.member_progress(customer_id,store_id,product_id,item_id) values ($1,$2,$3,$4)', ids)).rejects.toThrow()
      const { rows } = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid = 'public.member_progress'::regclass")
      expect(rows[0].relrowsecurity).toBe(true)
      const policies = await db.query("select * from pg_policies where schemaname='public' and tablename='member_progress'")
      expect(policies.rows).toHaveLength(0)
    } finally { await db.close() }
  })
})
