import { describe, expect, it } from 'vitest'
import { setup, save, apply, plans, store, otherStore, customer } from '../helpers/checkout-db'

describe('checkout plans SQL', () => {
  it('saves independent plans with one code, normalizes aliases and keeps legacy orders unchanged', async () => {
    const db=await setup()
    await db.exec(`insert into orders(payt_transaction_id,payt_product_code,customer_email,status,status_rank) values ('OLD','LEGACY','a@example.test','pago',1)`)
    await save(db, plans.map((p,i)=> i ? p : {...p, match_values:['https://PAYT.site/Basic/?utm=x#y']}))
    expect((await db.query('select match_values from offers where name=$1',['Basic'])).rows).toEqual([{match_values:['https://payt.site/Basic']}])
    expect((await db.query('select offer_id from orders')).rows).toEqual([{offer_id:null}])
  })
  it('persists exact checkout plan and its own normalized identifiers', async () => {
    const db=await setup(); await save(db)
    const result=await apply(db,{url:'https://payt.site/Basic/?utm=x'})
    expect(result.out_offer_id).toBe((await db.query<{id:string}>("select id from offers where name='Basic'")).rows[0].id)
    expect(result.out_identification_warning).toBeNull()
    expect((await db.query('select checkout_url, upsell_code from orders')).rows).toEqual([{checkout_url:'https://payt.site/Basic',upsell_code:null}])
  })
  it.each([null,'https://payt.site/Unknown','https://evil.test/Basic'])('unrecognized identifier %s grants nothing until a valid replay', async url => {
    const db=await setup(); await save(db)
    const unresolved=await apply(db,{url})
    expect(unresolved.out_offer_id).toBeNull(); expect(unresolved.out_identification_warning).toBeTruthy()
    const resolved=await apply(db,{url:'https://payt.site/Basic'})
    expect(resolved.out_offer_id).toBeTruthy(); expect(resolved.out_changed).toBe(true); expect(resolved.out_order_id).toBe(unresolved.out_order_id)
  })
  it('keeps persisted plan and payment owner on missing or conflicting identifiers, including refund', async () => {
    const db=await setup(); await save(db)
    const paid=await apply(db,{url:'https://payt.site/Basic'})
    const missing=await apply(db,{email:'attacker@example.test'})
    expect(missing.out_offer_id).toBe(paid.out_offer_id); expect(missing.out_customer_email).toBe('a@example.test'); expect(missing.out_identification_warning).toBeNull()
    const refund=await apply(db,{url:'https://payt.site/Full',status:'reembolsado',email:'attacker@example.test'})
    expect(refund.out_offer_id).toBe(paid.out_offer_id); expect(refund.out_status).toBe('reembolsado'); expect(refund.out_identification_warning).toBeTruthy()
    expect((await apply(db,{url:'https://payt.site/Basic'})).out_status).toBe('reembolsado')
  })
  it('resolves final-before-paid without resurrecting access, and updates owner only at first payment', async () => {
    const db=await setup(); await save(db)
    await apply(db,{status:'chargeback'})
    const final=await apply(db,{url:'https://payt.site/Full'})
    expect(final.out_status).toBe('chargeback'); expect(final.out_offer_id).toBeTruthy()
    await apply(db,{tx:'PENDING',status:'pendente',url:'https://payt.site/Basic',email:'old@example.test'})
    expect((await apply(db,{tx:'PENDING'})).out_customer_email).toBe('a@example.test')
  })
  it('resolves own upsell and refuses ambiguous checkout plus upsell', async () => {
    const db=await setup(); await save(db)
    expect((await apply(db,{upsell:' UP '})).out_offer_id).toBe((await db.query<{id:string}>("select id from offers where name='Upsell'")).rows[0].id)
    const conflict=await apply(db,{tx:'BOTH',upsell:'UP',url:'https://payt.site/Basic'})
    expect(conflict.out_offer_id).toBeNull(); expect(conflict.out_identification_warning).toBeTruthy()
  })
  it('rejects cross-store bindings and code reassignment through direct writes', async () => {
    const db=await setup(); await save(db)
    const paid=await apply(db,{url:'https://payt.site/Basic'})
    await expect(db.query('update orders set store_id=$1 where id=$2',[otherStore,paid.out_order_id])).rejects.toThrow()
    await expect(db.query("update orders set payt_product_code='OTHER' where id=$1",[paid.out_order_id])).rejects.toThrow()
    await expect(db.query("update offers set match_type='product', match_values='{}' where id=$1",[paid.out_offer_id])).rejects.toThrow()
    await expect(db.query("update offers set payt_product_code='OTHER' where id=$1",[paid.out_offer_id])).rejects.toThrow()
  })
  it('rejects overlap, mixed modes, foreign group/store and unsafe aliases atomically', async () => {
    const db=await setup(); const groupId=await save(db)
    for (const alias of ['http://payt.site/X','https://evil.test/X','https://payt.site@evil.test/X','https://payt.site/']) {
      await expect(save(db,[{...plans[0],payt_product_code:'NEW',match_values:[alias]}])).rejects.toThrow()
    }
    await expect(save(db,[{...plans[0],payt_product_code:'SHARED'}],null,otherStore)).rejects.toThrow()
    await expect(save(db,[{...plans[0]}])).rejects.toThrow()
    const current=(await db.query<{id:string;name:string;payt_product_code:string;match_type:string;checkout_code:string|null;match_values:string[]}>('select id,name,payt_product_code,match_type,checkout_code,match_values from offers where group_id=$1 order by name',[groupId])).rows.map(p=>({...p,grants:plans[0].grants}))
    await expect(save(db,[...current,{...plans[0],name:'Overlap',match_values:['https://payt.site/Basic?utm=x']}],groupId)).rejects.toThrow()
    await expect(save(db,[...current,{name:'Mixed',payt_product_code:'SHARED',grants:plans[0].grants}],groupId)).rejects.toThrow()
    expect((await db.query('select id from offers where group_id=$1',[groupId])).rows).toHaveLength(3)
  })
  it('allows adding aliases but forbids changing or removing established identity', async () => {
    const db=await setup(); const groupId=await save(db)
    const current=(await db.query<{id:string;name:string;payt_product_code:string;match_type:string;checkout_code:string|null;match_values:string[]}>('select id,name,payt_product_code,match_type,checkout_code,match_values from offers where group_id=$1 order by name',[groupId])).rows.map(p=>({...p,grants:plans[0].grants}))
    const extended=current.map(p=>p.name==='Basic'?{...p,match_values:[...(p.match_values as string[]),'https://payt.site/Alias']}:p)
    await save(db,extended,groupId)
    await expect(save(db,current,groupId)).rejects.toThrow()
  })
  it('manual grants bind selected plan; success counts purchases once and excludes unresolved', async () => {
    const db=await setup(); await save(db)
    const basic=(await db.query<{id:string}>("select id from offers where name='Basic'")).rows[0].id
    await db.query('select create_manual_order_atomic($1,$2,$3,$4,$5)',[store,basic,customer,'admin@example.test','test'])
    expect((await db.query("select offer_id from orders where source='manual'")).rows).toEqual([{offer_id:basic}])
    await apply(db,{tx:'UNKNOWN'}); await apply(db,{tx:'BASIC',url:'https://payt.site/Basic'})
    expect((await db.query('select paid_orders from store_customer_success($1)',[store])).rows).toEqual([{paid_orders:2}])
    await expect(db.query("insert into orders(store_id,payt_transaction_id,payt_product_code,customer_email,status,status_rank,source) values ($1,'BADMANUAL','SHARED','a@example.test','pago',1,'manual')",[store])).rejects.toThrow()
    await expect(db.query('select delete_offer_atomic($1,$2,$3)',[basic,store,'Basic'])).rejects.toThrow(/pedidos/i)
  })
  it('preserves null binding and duplicate semantics for an existing legacy paid order', async () => {
    const db=await setup()
    await db.query("select * from apply_order_status($1,'LEGACY-TX','LEGACY','Legacy','a@example.test','A','pago',1::smallint,'order',false,100)",[store])
    const replay=await apply(db,{tx:'LEGACY-TX',code:'LEGACY'})
    expect(replay).toMatchObject({out_offer_id:null,out_changed:false,out_status:'pago'})
    expect((await db.query('select offer_id,status from orders')).rows).toEqual([{offer_id:null,status:'pago'}])
    const refund=await apply(db,{tx:'LEGACY-TX',code:'LEGACY',status:'reembolsado'})
    expect(refund).toMatchObject({out_offer_id:null,out_changed:true,out_status:'reembolsado'})
  })
  it('retains legacy RPC and restricts new RPC execution', async () => {
    const db=await setup()
    await db.query("select * from apply_order_status($1,'LEGACY-TX','LEGACY','Legacy','a@example.test','A','pago',1::smallint,'order',false,100)",[store])
    expect((await db.query('select offer_id from orders')).rows).toEqual([{offer_id:null}])
    const signature='public.apply_payt_order_status(uuid,text,text,text,text,text,text,smallint,text,boolean,integer,text,text,boolean)'
    expect((await db.query("select rolname,has_function_privilege(rolname,$1,'execute') as allowed from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname",[signature])).rows).toEqual([{rolname:'anon',allowed:false},{rolname:'authenticated',allowed:false},{rolname:'service_role',allowed:true}])
  })
})
