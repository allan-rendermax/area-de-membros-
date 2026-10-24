import { createClient } from '@supabase/supabase-js'
import { expect,it,vi } from 'vitest'
import { parseProductForm } from '@/lib/admin/forms'
import { saveProductEditorial } from '@/lib/data/products-admin'
const admin=vi.hoisted(()=>({client:vi.fn()}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:admin.client}))
it('sends product and ordered relations together and returns the committed revision',async()=>{
  const requests:{path:string;body:Record<string,unknown>}[]=[]
  admin.client.mockReturnValue(createClient('https://db.example.test','test',{global:{fetch:async(url,init)=>{
    requests.push({path:new URL(String(url)).pathname,body:JSON.parse(String(init?.body))})
    return new Response(JSON.stringify([{id:'p',editorial_revision:7}]),{headers:{'content-type':'application/json'}})
  }}}))
  const f=new FormData();f.set('title','Atlas');f.set('catalog_visibility','contextual');f.set('contextual_complement_ids','[]')
  expect(await saveProductEditorial(parseProductForm(f,'s'))).toEqual({id:'p',editorialRevision:7})
  expect(requests).toHaveLength(1)
  expect(requests[0].path).toBe('/rest/v1/rpc/save_contextual_product')
  expect(requests[0].body).toMatchObject({p_store_id:'s',p_product_id:null,p_expected_revision:null,p_complement_ids:[],p_patch:{title:'Atlas',catalog_visibility:'contextual'}})
  expect(requests[0].body.p_patch).not.toHaveProperty('updated_at')
})
