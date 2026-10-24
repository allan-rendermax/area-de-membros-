import { beforeEach,expect,it,vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import VitrinePage from '@/app/[loja]/page'
import ProdutoPage from '@/app/[loja]/produto/[slug]/page'
import ItemPage from '@/app/[loja]/item/[id]/page'
import { product,relation } from '../fixtures/contextual-products'
const state=vi.hoisted(()=>({granted:['atlas','guia'],relationsAvailable:true}))
const products=[product('atlas'),product('guia',{catalogVisibility:'contextual'}),product('optional',{catalogVisibility:'contextual'}),product('next')]
const relations=[relation('atlas','guia'),relation('atlas','optional')]
const store={id:'s1',slug:'arq',name:'Arq',memberLibraryMode:'grouped' as const,logoUrl:null,supportUrl:null,supportWhatsapp:null,loginImageUrl:null}
const customer={id:'c',email:'c@example.test',name:'C',blockedAt:null}
const item={id:'00000000-0000-4000-8000-000000000101',moduleId:'m',title:'Material',kind:'link' as const,url:'https://example.test/material',coverUrl:null,isPublished:true,sortOrder:0}
const moduleRow={id:'m',productId:'atlas',title:'Material',sortOrder:0,isPublished:true,requiredLevel:'basic' as const,items:[item]}
vi.mock('next/navigation',()=>({usePathname:()=>'/arq',useSearchParams:()=>new URLSearchParams(),useRouter:()=>({refresh:()=>{}}),redirect:(url:string)=>{throw new Error(`redirect:${url}`)},notFound:()=>{throw new Error('not-found')}}))
vi.mock('@/lib/membros/session',()=>({requireStoreSession:async()=>({store,customer})}))
vi.mock('@/lib/data/access',()=>({loadGrantedProductLevels:async()=>new Map(state.granted.map(id=>[id,'complete'])),loadStoreAccess:async()=>({products,granted:new Set(state.granted),levels:new Map(state.granted.map(id=>[id,'complete']))})}))
vi.mock('@/lib/data/products',()=>({listProducts:async()=>products,getProductBySlug:async(_store:string,slug:string)=>products.find(p=>p.slug===slug),listModulesWithItems:async()=>[moduleRow],getItemWithContext:async()=>({item,module:moduleRow,product:products[0]})}))
vi.mock('@/lib/data/contextual-complements',()=>({listContextualRelations:async()=>({relations:state.relationsAvailable?relations:[],available:state.relationsAvailable})}))
vi.mock('@/lib/data/product-complement',()=>({loadProductComplement:async()=>null}))
vi.mock('@/lib/data/item-access',()=>({listRecentProductVisits:async()=>[]}))
vi.mock('@/lib/data/member-progress',()=>({listCompletedItemIds:async()=>[]}))
vi.mock('@/app/[loja]/progresso/actions',()=>({saveCompletion:vi.fn()}))
vi.mock('@/app/[loja]/historico/actions',()=>({recordVisit:vi.fn()}))
beforeEach(()=>{state.granted=['atlas','guia'];state.relationsAvailable=true})
const query=(q={})=>({params:Promise.resolve({loja:'arq'}),searchParams:Promise.resolve(q)})
it('home groups owned complements and hides contextual offers from all general tracks',async()=>{
  const html=renderToStaticMarkup(await VitrinePage(query() as never))
  expect(html).toContain('Meus materiais');expect(html).toContain('1 complemento adquirido')
  expect(html).toContain('/arq/produto/guia');expect(html).not.toContain('Conhecer optional')
  expect(html).not.toContain('optional — bloqueado');expect(html).toContain('next')
})
it('composes contextual shelves on the first-item product path and direct item path',async()=>{
  const p=renderToStaticMarkup(await ProdutoPage({...query(),params:Promise.resolve({loja:'arq',slug:'atlas'})} as never))
  const i=renderToStaticMarkup(await ItemPage({...query(),params:Promise.resolve({loja:'arq',id:item.id})} as never))
  for(const html of [p,i]){expect(html).toContain('Seus complementos');expect(html).toContain('Conhecer optional');expect(html).toContain('lesson-heading');expect(html).not.toContain('Abrir meus materiais')}
})
it('keeps acquired materials available when relations fail and omits offers',async()=>{
  state.relationsAvailable=false
  const html=renderToStaticMarkup(await VitrinePage(query() as never))
  expect(html).toContain('/arq/produto/guia');expect(html).not.toContain('complemento adquirido');expect(html).not.toContain('optional — bloqueado')
})
it('redirects old purchase links inside eligible parents, otherwise shows support without a bump offer',async()=>{
  state.granted=['atlas']
  await expect(VitrinePage(query({comprar:'guia'}) as never)).rejects.toThrow('redirect:/arq/produto/atlas?complemento=guia#complementos')
  state.granted=[]
  const html=renderToStaticMarkup(await VitrinePage(query({comprar:'guia'}) as never))
  expect(html).toContain('não está liberado');expect(html).not.toContain('Conhecer guia')
})

it('preserves requested legacy upsell prompt in grouped mode',async()=>{
 products.push(product('protocolo',{role:'upsell',checkoutUrl:'https://example.test/checkout'}))
 products[0].complementaryProductId='protocolo'
 try{
  const html=renderToStaticMarkup(await VitrinePage(query({comprar:'protocolo'}) as never))
  expect(html).toContain('aria-label="Compra solicitada"')
  expect(html).toContain('https://example.test/checkout')
 }finally{products.pop();products[0].complementaryProductId=null}
})

