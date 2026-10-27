import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {afterAll,beforeAll,expect,it} from 'vitest'
let db:PGlite
const customer='00000000-0000-4000-8000-000000000001',store='00000000-0000-4000-8000-000000000002'
beforeAll(async()=>{
  db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create table customers(id uuid primary key);create table stores(id uuid primary key);insert into customers values('${customer}');insert into stores values('${store}');`)
  await db.exec(readFileSync('supabase/migrations/20261025010000_telegram_support.sql','utf8'))
  await db.exec(readFileSync('supabase/migrations/20261026010000_telegram_team.sql','utf8'))
})
afterAll(async()=>{await db?.close()})
async function change(kind='grant',target=456,version=0) {
  const r=await db.query<{id:string}>(`insert into telegram_team_changes(owner_id,chat_id,kind,state,target_id,target_name,expected_version) values(123,123,$1,'confirm',$2,'Maria',$3) returning id`,[kind,target,version]);return r.rows[0].id
}
async function apply(id:string,actor=123){return (await db.query<{result:string}>('select telegram_team_apply($1,$2,array[123]::bigint[]) as result',[id,actor])).rows[0].result}
it('tabelas e função são privadas',async()=>{
  for(const role of ['anon','authenticated'])for(const table of ['telegram_support_members','telegram_team_changes']){
    expect((await db.query<{ok:boolean}>(`select has_table_privilege($1,$2,'select') as ok`,[role,table])).rows[0].ok).toBe(false)
  }
  expect((await db.query<{ok:boolean}>(`select has_function_privilege('anon','telegram_team_apply(uuid,bigint,bigint[])','execute') as ok`)).rows[0].ok).toBe(false)
})
it('protege proprietário, exige autor e expiração',async()=>{
  expect(await apply(await change('revoke',123))).toBe('protected')
  const id=await change();expect(await apply(id,456)).toBe('denied')
  await db.query(`update telegram_team_changes set expires_at=now()-interval '1 second' where id=$1`,[id])
  expect(await apply(id)).toBe('unavailable')
})
it('confirma uma vez, revoga, cancela ações pendentes e não ressuscita permissões com botão antigo',async()=>{
  const oldGrant=await change(),grant=await change();expect(await apply(grant)).toBe('applied');expect(await apply(grant)).toBe('done')
  await db.exec(`insert into telegram_support_actions(user_id,chat_id,customer_id,store_id,kind,expected_email,state) values(456,456,'${customer}','${store}','resend','a@test.com','confirm'),(456,456,'${customer}','${store}','resend','a@test.com','uncertain')`)
  const revoke=await change('revoke',456,1);expect(await apply(revoke)).toBe('applied')
  expect(await apply(oldGrant)).toBe('stale')
  expect((await db.query<{active:boolean;version:number}>('select active,version from telegram_support_members where user_id=456')).rows[0]).toEqual({active:false,version:2})
  expect((await db.query<{state:string}>('select state from telegram_support_actions order by state')).rows.map(r=>r.state)).toEqual(['cancelled','uncertain'])
  expect(await apply(await change('grant',456,2))).toBe('applied')
})
