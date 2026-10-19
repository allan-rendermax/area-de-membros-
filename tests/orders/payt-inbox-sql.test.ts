import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

it('persiste antes do aceite, deduplica, serializa uma transação e recupera leases sem tocar eventos antigos', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table payt_events(id uuid primary key default gen_random_uuid(), payload jsonb not null, key_valid boolean, outcome text, error text, processed_at timestamptz, received_at timestamptz default now());
      insert into payt_events(payload,outcome) values ('{}','liberado');`)
    await db.exec(readFileSync('supabase/migrations/20261019010000_payt_inbox.sql', 'utf8'))
    const enqueue = (key: string, tx: string) => db.query('select enqueue_payt_postback($1,$2,$3::jsonb) as id', [key, tx, '{"status":"paid"}'])
    const first = await enqueue('key1','sale1')
    expect(await enqueue('key1','sale1')).toEqual(first)
    await enqueue('key2','sale1')
    await enqueue('key3','sale2')
    const claim = () => db.query<{ id: string; lease_token: string; transaction_id: string }>('select * from claim_payt_postback()')
    const a = (await claim()).rows[0]
    const b = (await claim()).rows[0]
    expect(a.transaction_id).toBe('sale1')
    expect(b.transaction_id).toBe('sale2')
    expect((await claim()).rows).toHaveLength(0)
    await db.query("update payt_inbox set state='done' where id=$1", [a.id])
    await enqueue('key1', 'sale1')
    expect((await db.query('select state from payt_inbox where id=$1', [a.id])).rows).toEqual([{ state: 'done' }])
    const c = (await claim()).rows[0]
    expect(c.transaction_id).toBe('sale1')
    await db.query("update payt_inbox set lease_until=now()-interval '1 second' where id=$1", [c.id])
    const reclaimed = (await claim()).rows[0]
    expect(reclaimed.id).toBe(c.id)
    expect(reclaimed.lease_token).not.toBe(c.lease_token)
    await db.query("update payt_inbox set state='pending', attempts=5 where id=$1", [c.id])
    await claim()
    expect((await db.query('select state from payt_inbox where id=$1', [c.id])).rows).toEqual([{ state: 'failed' }])
    await enqueue('key2', 'sale1')
    expect((await db.query('select state,attempts from payt_inbox where id=$1', [c.id])).rows).toEqual([{ state: 'pending', attempts: 0 }])
    expect((await db.query("select count(*)::int as n from payt_events where outcome='liberado'")).rows).toEqual([{ n: 1 }])
    expect((await db.query('select count(*)::int as n from payt_inbox')).rows).toEqual([{ n: 3 }])
    expect((await db.query("select has_function_privilege('anon','enqueue_payt_postback(text,text,jsonb)','execute') as allowed")).rows).toEqual([{ allowed: false }])
  } finally { await db.close() }
})
