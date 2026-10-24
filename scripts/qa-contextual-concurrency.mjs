import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const {default:EmbeddedPostgres}=await import(pathToFileURL(resolve(process.env.EMBEDDED_POSTGRES_MODULE)))
const pg=new EmbeddedPostgres({databaseDir:resolve('.superpowers/sdd/2026-10-24-complementos-contextuais-netflix/pg-data'),port:54339,user:'postgres',password:'local-fixture-only',persistent:true,onLog:()=>{},onError:()=>{}})
await pg.initialise();await pg.start()
const c1=pg.getPgClient('postgres','127.0.0.1'),c2=pg.getPgClient('postgres','127.0.0.1')
await c1.connect();await c2.connect()
const s='00000000-0000-4000-8000-000000000001',a='00000000-0000-4000-8000-000000000101',b='00000000-0000-4000-8000-000000000102',c='00000000-0000-4000-8000-000000000103'
try{
 await c1.query("create role anon;create role authenticated;create role service_role bypassrls;create table stores(id uuid primary key);create table products(id uuid primary key default gen_random_uuid(),store_id uuid not null references stores(id) on delete cascade,slug text not null,title text not null,description text not null default '',updated_at timestamptz default now(),complementary_product_id uuid,unique(store_id,id),unique(store_id,slug));")
 await c1.query('insert into stores values($1)',[s])
 for(const [id,slug] of [[a,'a'],[b,'b'],[c,'c']])await c1.query('insert into products(id,store_id,slug,title) values($1,$2,$3,$3)',[id,s,slug])
 for(const name of ['20261024020000_contextual_complements','20261024021000_save_contextual_product'])await c1.query(await readFile('supabase/migrations/'+name+'.sql','utf8'))
 const save=(client,id,revision,targets,title)=>client.query('select * from save_contextual_product($1,$2,$3,$4,$5)',[s,id,revision,JSON.stringify({title}),targets])
 await c1.query('begin');await save(c1,a,0,[b],'Winner')
 // The second request starts while the first transaction still owns the store lock.
 let completed=false
 const second=save(c2,a,0,[c],'Loser').then(()=>{completed=true;return null},e=>{completed=true;return e})
 await new Promise(r=>setTimeout(r,120));assert.equal(completed,false)
 await c1.query('commit')
 const stale=await second;assert.equal(stale?.code,'40001')
 assert.equal((await c1.query('select title from products where id=$1',[a])).rows[0].title,'Winner')
 assert.deepEqual((await c1.query('select complement_product_id from product_complements')).rows.map(r=>r.complement_product_id),[b])
 await c1.query('delete from product_complements')
 await c1.query('begin');await c1.query('insert into product_complements values($1,$2,$3,0)',[s,a,b])
 const chain=c2.query('insert into product_complements values($1,$2,$3,0)',[s,b,c]).then(()=>null,e=>e)
 await new Promise(r=>setTimeout(r,120));await c1.query('commit')
 assert.match((await chain)?.message,/não pode ser principal/)
 const report={postgres:(await c1.query('select version()')).rows[0].version,staleEditor:'passed: blocked then 40001; winner and relations intact',concurrentChain:'passed: blocked then rejected',connections:2}
 await writeFile('artifacts/complementos-contextuais-20261024/qa/postgres-concurrency.json',JSON.stringify(report,null,2));console.log(report)
}finally{await c1.end();await c2.end();await pg.stop()}

