import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

it('migra versões existentes sem interromper front de nível único ou packs complementares', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create table products(id int primary key, role text); create table modules(id int primary key, product_id int, required_level text, is_published boolean);
      create table items(module_id int, is_published boolean, kind text, url text);
      insert into products values (1,'front'),(2,'front'),(3,'upsell'),(4,'front'),(5,'front');
      insert into modules values (10,1,'basic',true),(11,1,'complete',true),(12,2,'basic',true),(13,3,'complete',true),(14,4,'complete',false),(15,5,'complete',true);
      insert into items values (11,true,'arquivo','https://example.com/full.pdf'),(13,true,'link','https://example.com/full'),(14,true,'arquivo','https://example.com/draft.pdf'),(15,false,'arquivo','https://example.com/hidden.pdf');`)
    await db.exec(readFileSync(new URL('../../supabase/migrations/20260925010000_product_versions_upgrade.sql', import.meta.url), 'utf8'))
    expect((await db.query('select id,content_mode from products order by id')).rows).toEqual([
      { id: 1, content_mode: 'versions' }, { id: 2, content_mode: 'sections' }, { id: 3, content_mode: 'sections' }, { id: 4, content_mode: 'sections' }, { id: 5, content_mode: 'sections' },
    ])
    await expect(db.exec("update products set content_mode='invalid' where id=1")).rejects.toThrow()
    await expect(db.exec("update products set upgrade_button_text=repeat('x',81) where id=1")).rejects.toThrow()
    await db.exec("update products set upgrade_button_text='Liberar Completo',upgrade_image_url='https://example.com/mockup.png' where id=1")
  } finally { await db.close() }
})
