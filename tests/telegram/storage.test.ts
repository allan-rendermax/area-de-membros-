import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let db: PGlite
const customer = '00000000-0000-4000-8000-000000000001'
const store = '00000000-0000-4000-8000-000000000002'
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table public.customers(id uuid primary key); create table public.stores(id uuid primary key);
    insert into public.customers values ('${customer}'); insert into public.stores values ('${store}');`)
  await db.exec(readFileSync('supabase/migrations/20261025010000_telegram_support.sql', 'utf8'))
})
afterAll(async () => { await db?.close() })
async function action() {
  const r = await db.query<{ id: string }>(`insert into public.telegram_support_actions(user_id,chat_id,customer_id,store_id,kind,expected_email,state) values(123,123,$1,$2,'resend','old@example.test','confirm') returning id`, [customer, store])
  return r.rows[0].id
}
async function claim(id: string, user = 123, chat = 123) {
  return db.query(`update public.telegram_support_actions set state='processing' where id=$1 and user_id=$2 and chat_id=$3 and state='confirm' and expires_at>now() returning id`, [id, user, chat])
}
describe('persistência privada e deduplicação', () => {
  it('deduplica updates sem efeito duplicado', async () => {
    await db.query('insert into public.telegram_support_updates(update_id) values(1)')
    await expect(db.query('insert into public.telegram_support_updates(update_id) values(1)')).rejects.toThrow(/duplicate/)
  })
  it('nega leitura e gravação para anon e authenticated', async () => {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ allowed: boolean }>(`select has_table_privilege($1,'public.telegram_support_actions','select') as allowed`, [role])
      expect(r.rows[0].allowed).toBe(false)
    }
    const r = await db.query<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where relname='telegram_support_actions'`)
    expect(r.rows[0].relrowsecurity).toBe(true)
  })
  it('claim exige operador e chat e é de uso único', async () => {
    const id = await action()
    expect((await claim(id, 456)).rows).toHaveLength(0)
    expect((await claim(id, 123, 456)).rows).toHaveLength(0)
    expect((await claim(id)).rows).toHaveLength(1)
    expect((await claim(id)).rows).toHaveLength(0)
    await db.query(`update public.telegram_support_actions set state='done' where id=$1`, [id])
  })
  it('ação expirada não é executada', async () => {
    const id = await action()
    await db.query(`update public.telegram_support_actions set expires_at=now()-interval '1 minute' where id=$1`, [id])
    expect((await claim(id)).rows).toHaveLength(0)
  })
  it('bloqueia segunda ação para cliente em execução ou com resultado incerto', async () => {
    const a = await action(), b = await action()
    await claim(a)
    await expect(claim(b)).rejects.toThrow(/duplicate/)
    await db.query(`update public.telegram_support_actions set state='uncertain' where id=$1`, [a])
    await expect(claim(b)).rejects.toThrow(/duplicate/)
    await db.query(`update public.telegram_support_actions set state='done' where id=$1`, [a])
    expect((await claim(b)).rows).toHaveLength(1)
  })
})
