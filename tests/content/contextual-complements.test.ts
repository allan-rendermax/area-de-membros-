import { createClient } from '@supabase/supabase-js'
import { expect,it,vi } from 'vitest'
import { listContextualRelations } from '@/lib/data/contextual-complements'
const admin=vi.hoisted(()=>({client:vi.fn()}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:admin.client}))
it('paginates within the store and maps all relations without per-product queries',async()=>{
  const urls:URL[]=[]
  admin.client.mockReturnValue(createClient('https://db.example.test','test',{global:{fetch:async(input)=>{
    const url=new URL(String(input));urls.push(url)
    const rows=urls.length===1?Array.from({length:500},(_,i)=>({store_id:'s',parent_product_id:'p',complement_product_id:String(i),sort_order:i})):[]
    return new Response(JSON.stringify(rows),{headers:{'content-type':'application/json'}})
  }}}))
  const result=await listContextualRelations('s')
  expect(result.available).toBe(true);expect(result.relations).toHaveLength(500)
  expect(result.relations[0]).toEqual({storeId:'s',parentProductId:'p',complementProductId:'0',sortOrder:0})
  expect(urls).toHaveLength(2);expect(urls.every(u=>u.searchParams.get('store_id')==='eq.s')).toBe(true)
  expect(urls[1].searchParams.get('offset')).toBe('500')
})
it('drops partial relationships on server failure without claiming access',async()=>{
  admin.client.mockReturnValue(createClient('https://db.example.test','test',{global:{fetch:async()=>new Response('{"message":"unavailable"}',{status:503})}}))
  expect(await listContextualRelations('s')).toEqual({relations:[],available:false})
})
