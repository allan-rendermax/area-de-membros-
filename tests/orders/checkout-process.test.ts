import { describe, expect, it } from 'vitest'
import { processPostback, type ApplyOrderInput } from '@/lib/orders/process-postback'
import { grantedProductLevels } from '@/lib/access/access'
import type { OrderStatus, ProductLink } from '@/lib/domain/types'
import { FakeRepo, FakeNotifier } from '../helpers/fakes'
import { setup, save, apply, store, product } from '../helpers/checkout-db'

async function fixture() {
  const db=await setup(); await save(db)
  await db.query("insert into offer_products(offer_id,product_id) select id,$1 from offers where payt_product_code='LEGACY'",[product])
  const offerRows=(await db.query<{id:string;name:string}>('select id,name from offers')).rows
  class Repo extends FakeRepo {
    storesByCode = { SHARED: {id:store,slug:'arq',name:'ARQ'}, LEGACY: {id:store,slug:'arq',name:'ARQ'} }
    // Deliberately unsafe code-wide catalog: the processor must never use this for a resolved plan.
    productsByCode = { SHARED: [{id:product,title:'Atlas'},{id:'full-only',title:'Full only'}] }
    async applyOrderStatus(input: ApplyOrderInput) {
      const result=await apply(db,{tx:input.transactionId,code:input.productCode,status:input.status,url:input.checkoutUrl,upsell:input.upsellCode,email:input.customerEmail})
      return {orderId:result.out_order_id,changed:result.out_changed,status:result.out_status as OrderStatus,customerEmail:result.out_customer_email,customerName:'A',offerId:result.out_offer_id,identificationWarning:result.out_identification_warning}
    }
    async getProductsForOrder(code:string,offerId:string|null) {
      if(code==='LEGACY') return [{id:product,title:'Atlas'}]
      if(!offerId) return []
      const offer=offerRows.find(o=>o.id===offerId)
      return offer?.name==='Basic' ? [{id:product,title:'Atlas'}] : [{id:product,title:'Atlas'},{id:'full-only',title:'Full only'}]
    }
  }
  const repo=new Repo(); const notifier=new FakeNotifier()
  const run=(extra:Record<string,unknown>={})=>processPostback({integration_key:'key',transaction_id:'TX',status:'paid',customer:{email:'a@example.test'},product:{code:'SHARED'},...extra},{repo,notify:async notice=>{
    const result=await notifier.notify(notice); if(result.ok) repo.markNotified(notice.customerId,notice.store.id,notice.products.map(p=>p.id)); return result
  },integrationKey:'key'})
  const level=async()=> {
    const orders=(await db.query<{productCode:string;offerId:string|null;status:OrderStatus}>('select payt_product_code as "productCode",offer_id as "offerId",status from orders')).rows
    const links=(await db.query<ProductLink>('select o.payt_product_code as "productCode",o.id as "offerId",o.match_type as "matchType",p.product_id as "productId",p.grant_level as "grantLevel" from offers o join offer_products p on p.offer_id=o.id')).rows
    return grantedProductLevels(orders,links,false).get(product)
  }
  return {run,repo,notifier,level,db}
}

describe('checkout processing with real persisted orders and fake delivery',()=>{
  it('sends only resolved plan products, suppresses duplicate and preserves basic after complete refund',async()=>{
    const f=await fixture()
    await f.run({link:{url:'https://payt.site/Basic?utm=x'}})
    expect(f.notifier.sent[0].products).toEqual([{id:product,title:'Atlas'}])
    expect(await f.level()).toBe('basic')
    await f.run(); expect(f.notifier.sent).toHaveLength(1)
    await f.run({transaction_id:'UPGRADE',link:{url:'https://payt.site/Full'}})
    expect(await f.level()).toBe('complete')
    await f.run({transaction_id:'UPGRADE',status:'refunded'})
    expect(await f.level()).toBe('basic')
  })
  it('does not email unresolved paid order, then delivers after same-status valid replay',async()=>{
    const f=await fixture()
    await f.run({link:{url:'https://payt.site/Unknown'}})
    expect(f.notifier.sent).toHaveLength(0); expect(await f.level()).toBeUndefined()
    expect(f.repo.events[0].error).toContain('identificador_desconhecido')
    await f.run({link:{url:'https://payt.site/Basic'}})
    expect(f.notifier.sent).toHaveLength(1); expect(await f.level()).toBe('basic')
  })
  it('does not resend a prior notice on an existing legacy paid replay',async()=>{
    const f=await fixture()
    await f.db.query("select * from apply_order_status($1,'LEGACY-TX','LEGACY','Legacy','a@example.test','A','pago',1::smallint,'order',false,100)",[store])
    const {customer}=await f.repo.createCustomer('a@example.test','A')
    f.repo.markNotified(customer.id,store,[product])
    const replay=await f.run({transaction_id:'LEGACY-TX',product:{code:'LEGACY'}})
    expect(f.notifier.sent).toHaveLength(0)
    expect(replay).toMatchObject({outcome:'sem_mudanca',emailsSent:0,lines:[{offerId:null,changed:false,status:'pago'}]})
    expect(await f.level()).toBe('complete')
    expect((await f.db.query('select offer_id from orders')).rows).toEqual([{offer_id:null}])
  })
  it('records mismatch and refunds original plan without mailing another plan',async()=>{
    const f=await fixture()
    await f.run({link:{url:'https://payt.site/Basic'}})
    await f.run({status:'refunded',link:{url:'https://payt.site/Full'}})
    expect(f.repo.events[1].error).toContain('identificador_conflitante')
    expect(f.notifier.sent).toHaveLength(1); expect(await f.level()).toBeUndefined()
  })
})
