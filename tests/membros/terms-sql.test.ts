import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

it('mantém primeiro aceite, isola aluno/loja, protege dados públicos e acompanha exclusão da conta', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.customers(id uuid primary key);
      create table public.stores(id uuid primary key);`)
    await db.exec(readFileSync(new URL('../../supabase/migrations/20260926010000_member_terms_acceptance.sql', import.meta.url), 'utf8'))
    const student = '00000000-0000-4000-8000-000000000001'
    const store = '00000000-0000-4000-8000-000000000002'
    const other = '00000000-0000-4000-8000-000000000003'
    await db.query('insert into customers values ($1)', [student])
    await db.query('insert into stores values ($1),($2)', [store, other])
    await db.query('insert into member_terms_acceptance(customer_id,store_id,terms_version) values ($1,$2,$3)', [student,store,'first'])
    const before = (await db.query('select * from member_terms_acceptance')).rows
    await db.query('insert into member_terms_acceptance(customer_id,store_id,terms_version) values ($1,$2,$3) on conflict(customer_id,store_id) do nothing', [student,store,'new'])
    expect((await db.query('select * from member_terms_acceptance')).rows).toEqual(before)
    expect((await db.query('select * from member_terms_acceptance where store_id=$1', [other])).rows).toHaveLength(0)
    expect((await db.query("select relrowsecurity from pg_class where oid='public.member_terms_acceptance'::regclass")).rows).toEqual([{relrowsecurity:true}])
    expect((await db.query("select * from pg_policies where tablename='member_terms_acceptance'")).rows).toHaveLength(0)
    expect((await db.query("select has_table_privilege('anon','member_terms_acceptance','SELECT') as anon, has_table_privilege('authenticated','member_terms_acceptance','INSERT') as authenticated")).rows).toEqual([{anon:false,authenticated:false}])
    await db.query('delete from customers where id=$1', [student])
    expect((await db.query('select * from member_terms_acceptance')).rows).toHaveLength(0)
  } finally { await db.close() }
})
