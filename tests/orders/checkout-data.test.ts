import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasPaidOrderInStore, listAllOrderRefsByEmail, listOrders } from '@/lib/data/orders'
import { listPaytEvents } from '@/lib/data/payt-events'
import { getProductLinks, getProductsForCode, findStoreForProductCode } from '@/lib/data/products'
const doubles=vi.hoisted(()=>({client:vi.fn()}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:doubles.client}))
vi.mock('@/lib/data/customers',()=>({getCustomer:vi.fn()}))
let orderOffer:string|null=null
let requests:URL[]=[]
beforeEach(()=>{
 orderOffer=null;requests=[]
 doubles.client.mockImplementation(()=>createClient('https://test.supabase.co','test',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const req=new Request(input,init); const url=new URL(req.url);requests.push(url)
  let data:unknown=[]
  if(url.pathname.endsWith('/orders')) data=[{payt_product_code:'SHARED',offer_id:orderOffer,status:'pago'}]
  else if(url.pathname.endsWith('/offers')) {
    const rows=[{id:'basic',match_type:'checkout',payt_product_code:'SHARED',offer_products:[{product_id:'atlas',grant_level:'basic',products:{id:'atlas',title:'Atlas',sort_order:0,is_published:true}}],stores:{id:'store',slug:'arq',name:'ARQ'}}]
    data=url.searchParams.get('match_type')==='eq.product'?[]:rows
  }
  const head=req.method==='HEAD'
  return new Response(head?null:JSON.stringify(data),{status:200,headers:{'content-type':'application/json','content-range':'0-0/1'}})
 }}}))
})
describe('checkout-aware data readers',()=>{
 it('includes persisted offer identity in access readers',async()=>{
  orderOffer='basic'
  expect(await listAllOrderRefsByEmail('a@example.test')).toEqual([{productCode:'SHARED',offerId:'basic',status:'pago'}])
  expect(await getProductLinks('store')).toEqual([{productCode:'SHARED',offerId:'basic',matchType:'checkout',productId:'atlas',grantLevel:'basic'}])
 })
 it('denies login for unresolved shared purchase and allows its persisted plan',async()=>{
  expect(await hasPaidOrderInStore('a@example.test','store')).toBe(false)
  orderOffer='basic'
  expect(await hasPaidOrderInStore('a@example.test','store')).toBe(true)
 })
 it('code-only notification reader excludes specific plans',async()=>{
  expect(await getProductsForCode('SHARED')).toEqual([])
  expect(requests[0].searchParams.get('match_type')).toBe('eq.product')
 })
 it('includes identifier warnings in the admin problem filters',async()=>{
  await listOrders('store','problemas')
  expect(requests[0].searchParams.get('or')).toContain('identification_warning.not.is.null')
  await listPaytEvents('erros',0)
  expect(requests[1].searchParams.get('or')).toContain('identificador_')
 })
 it('finds one store despite multiple plans for a shared code',async()=>{
  expect(await findStoreForProductCode('SHARED')).toMatchObject({id:'store'})
  expect(requests[0].searchParams.get('limit')).toBe('1')
 })
})
