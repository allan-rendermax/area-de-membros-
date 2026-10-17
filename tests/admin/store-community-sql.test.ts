import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
it('seeds only architecture, is repeatable and preserves configuration', async () => {
  const db = new PGlite()
  try {
    await db.exec("create table public.stores (id text, slug text); insert into stores values ('a','arquitetura'), ('b','other')")
    const sql = readFileSync('supabase/migrations/20261016010000_store_community_whatsapp.sql', 'utf8')
    await db.exec(sql)
    await db.exec(sql)
    expect((await db.query('select community_whatsapp_url from stores order by id')).rows).toEqual([{ community_whatsapp_url: 'https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t' }, { community_whatsapp_url: null }])
    await db.exec("update stores set community_whatsapp_url = 'https://chat.whatsapp.com/Changed' where id = 'a'")
    await db.exec(sql)
    expect((await db.query('select community_whatsapp_url from stores where id = $1', ['a'])).rows[0]).toEqual({ community_whatsapp_url: 'https://chat.whatsapp.com/Changed' })
  } finally { await db.close() }
})
