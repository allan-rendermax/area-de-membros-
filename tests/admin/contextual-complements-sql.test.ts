import { expect, it } from 'vitest'
import { setup, save, s, a, b, c, foreign } from '../helpers/contextual-db'
it('groups many parents without chains, foreign-store or duplicate relations', async () => {
  const db = await setup()
  await save(db,a,0,{},[b])
  await save(db,c,0,{},[b])
  expect((await db.query('select * from product_complements')).rows).toHaveLength(2)
  for (const ids of [[a],[foreign],[b,b],[c]]) await expect(save(db,a,2,{},ids)).rejects.toThrow()
  await expect(db.exec(`insert into product_complements values ('${s}','${b}','${a}',0)`)).rejects.toThrow()
  await expect(db.exec(`insert into product_complements values ('${s}','${a}','${b}',0)`)).rejects.toThrow()
  await db.exec(`delete from products where id='${a}'`)
  expect((await db.query('select id from products where id=$1',[b])).rows).toHaveLength(1)
})
it('preserves by omission, clears explicitly, rolls back patch on invalid target and rejects stale edits', async () => {
  const db = await setup()
  await save(db,a,0,{title:'Revisado'},[b])
  const row = (await db.query<{editorial_revision:number}>('select editorial_revision from products where id=$1',[a])).rows[0]
  await expect(save(db,a,0,{title:'Stale'},[])).rejects.toThrow(/recarregue/i)
  await expect(save(db,a,Number(row.editorial_revision),{title:'Inválido'},[foreign])).rejects.toThrow()
  expect((await db.query<{title:string}>('select title from products where id=$1',[a])).rows[0].title).toBe('Revisado')
  await save(db,a,Number(row.editorial_revision),{description:'Sem apagar'})
  expect((await db.query('select * from product_complements')).rows).toHaveLength(1)
  const next=(await db.query<{editorial_revision:number}>('select editorial_revision from products where id=$1',[a])).rows[0]
  await save(db,a,Number(next.editorial_revision),{},[])
  expect((await db.query('select * from product_complements')).rows).toHaveLength(0)
})
it('has compatible defaults and denies public mutation or arbitrary patch fields', async () => {
  const db = await setup()
  expect((await db.query('select distinct catalog_visibility from products')).rows).toEqual([{catalog_visibility:'catalog'}])
  expect((await db.query('select distinct member_library_mode from stores')).rows).toEqual([{member_library_mode:'legacy'}])
  await expect(save(db,a,0,{store_id:s})).rejects.toThrow()
  await db.exec('set role anon')
  await expect(save(db,a,0,{title:'No'})).rejects.toThrow(/permission/i)
  await db.exec('reset role')
  await save(db,null,null,{title:'Novo',slug:'novo'},[])
  expect((await db.query("select title from products where slug='novo'")).rows).toEqual([{title:'Novo'}])
})
