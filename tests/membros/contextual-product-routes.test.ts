import { beforeEach,expect,it,vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import VitrinePage from '@/app/[loja]/page'
import ProdutoPage from '@/app/[loja]/produto/[slug]/page'
import ItemPage from '@/app/[loja]/item/[id]/page'
import { product,relation } from '../fixtures/contextual-products'
const state=vi.hoisted(()=>({granted:['atlas','guia'],relationsAvailable:true,noItems:false}))
const products=[product('atlas'),product('guia',{catalogVisibility:'contextual'}),product('optional',{catalogVisibility:'contextual',checkoutUrl:'https://example.test/optional-checkout'}),product('next')]
const relations=[relation('atlas','guia'),relation('atlas','optional')]
const store={id:'s1',slug:'arq',name:'Arq',memberLibraryMode:'grouped' as const,logoUrl:null,supportUrl:null,supportWhatsapp:null,loginImageUrl:null}
const customer={id:'c',email:'c@example.test',name:'C',blockedAt:null}
const item={id:'00000000-0000-4000-8000-000000000101',moduleId:'m',title:'Material',kind:'link' as const,url:'https://example.test/material',coverUrl:null,isPublished:true,sortOrder:0}
const moduleRow={id:'m',productId:'atlas',title:'Material',sortOrder:0,isPublished:true,requiredLevel:'basic' as const,items:[item]}
vi.mock('next/navigation',()=>({usePathname:()=>'/arq',useSearchParams:()=>new URLSearchParams(),useRouter:()=>({refresh:()=>{}}),redirect:(url:string)=>{throw new Error(`redirect:${url}`)},notFound:()=>{throw new Error('not-found')}}))
vi.mock('@/lib/membros/session',()=>({requireStoreSession:async()=>({store,customer})}))
vi.mock('@/lib/data/access',()=>({loadGrantedProductLevels:async()=>new Map(state.granted.map(id=>[id,'complete'])),loadStoreAccess:async()=>({products,granted:new Set(state.granted),levels:new Map(state.granted.map(id=>[id,'complete']))})}))
vi.mock('@/lib/data/products',()=>({listProducts:async()=>products,getProductBySlug:async(_store:string,slug:string)=>products.find(p=>p.slug===slug),listModulesWithItems:async()=>state.noItems?[]:[moduleRow],getItemWithContext:async()=>({item,module:moduleRow,product:products[0]})}))
vi.mock('@/lib/data/contextual-complements',()=>({listContextualRelations:async()=>({relations:state.relationsAvailable?relations:[],available:state.relationsAvailable})}))
vi.mock('@/lib/data/product-complement',()=>({loadProductComplement:async()=>null}))
vi.mock('@/lib/data/item-access',()=>({listRecentProductVisits:async()=>[]}))
vi.mock('@/lib/data/member-progress',()=>({listCompletedItemIds:async()=>[]}))
vi.mock('@/app/[loja]/progresso/actions',()=>({saveCompletion:vi.fn()}))
vi.mock('@/app/[loja]/historico/actions',()=>({recordVisit:vi.fn()}))
beforeEach(()=>{state.granted=['atlas','guia'];state.relationsAvailable=true;state.noItems=false})
const query=(q={})=>({params:Promise.resolve({loja:'arq'}),searchParams:Promise.resolve(q)})
it('home groups owned complements and hides contextual offers from all general tracks',async()=>{
  const html=renderToStaticMarkup(await VitrinePage(query() as never))
  expect(html).toContain('Meus materiais');expect(html).toContain('1 complemento adquirido')
  expect(html).toContain('/arq/produto/guia');expect(html).not.toContain('Conhecer optional')
  expect(html).not.toContain('optional — bloqueado');expect(html).toContain('next')
})
it('restores the historical presentation on the first-item product path and direct item path',async()=>{
  const p=renderToStaticMarkup(await ProdutoPage({...query(),params:Promise.resolve({loja:'arq',slug:'atlas'})} as never))
  const i=renderToStaticMarkup(await ItemPage({...query(),params:Promise.resolve({loja:'arq',id:item.id})} as never))
  for(const html of [p,i]){expect(html).not.toContain('Seus complementos');expect(html).not.toContain('Conhecer optional');expect(html).toContain('lesson-heading');expect(html).toContain('sm:sticky');expect(html).not.toContain('Abrir meus materiais')}
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

it.each([false,true])('keeps a requested complement purchasable after following the home redirect (empty product: %s)',async(noItems)=>{
  state.noItems=noItems
  let destination=''
  try { await VitrinePage(query({comprar:'optional'}) as never) }
  catch(error) { destination=(error as Error).message.replace(/^redirect:/,'') }
  const url=new URL(destination,'https://members.example.test')
  expect(url.pathname).toBe('/arq/produto/atlas')
  const html=renderToStaticMarkup(await ProdutoPage({params:Promise.resolve({loja:'arq',slug:'atlas'}),searchParams:Promise.resolve(Object.fromEntries(url.searchParams))} as never))
  expect(html).toContain('id="complementos"')
  expect(html).toContain('aria-label="Compra solicitada"')
  expect(html).toContain('href="https://example.test/optional-checkout"')
  const ordinary=renderToStaticMarkup(await ProdutoPage({...query(),params:Promise.resolve({loja:'arq',slug:'atlas'})} as never))
  expect(ordinary).not.toContain('Compra solicitada')
  expect(ordinary).not.toContain('optional-checkout')
})

it.each([false,true])('does not turn arbitrary complement queries into offers (empty product: %s)',async(noItems)=>{
  state.noItems=noItems
  products.push(product('draft',{catalogVisibility:'contextual',isPublished:false}),product('foreign',{storeId:'s2',catalogVisibility:'contextual'}))
  relations.push(relation('atlas','draft'),relation('atlas','foreign'))
  try {
    for(const complemento of ['missing','next','guia','draft','foreign']) {
      const html=renderToStaticMarkup(await ProdutoPage({...query({complemento}),params:Promise.resolve({loja:'arq',slug:'atlas'})} as never))
      expect(html,complemento).not.toContain('aria-label="Compra solicitada"')
    }
    state.granted=[]
    await expect(ProdutoPage({...query({complemento:'optional'}),params:Promise.resolve({loja:'arq',slug:'atlas'})} as never)).rejects.toThrow('redirect:/arq?comprar=atlas')
  } finally { products.splice(-2);relations.splice(-2) }
})

it('supports a requested complement from a direct item link',async()=>{
  const html=renderToStaticMarkup(await ItemPage({...query({complemento:'optional'}),params:Promise.resolve({loja:'arq',id:item.id})} as never))
  expect(html).toContain('href="https://example.test/optional-checkout"')
  expect(html).toContain('id="complementos"')
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


it('restores the October 19 library return and empty state without extra purchase navigation',async()=>{
 state.noItems=true
 const html=renderToStaticMarkup(await ProdutoPage({...query(),params:Promise.resolve({loja:'arq',slug:'guia'})} as never))
 expect(html).toContain('aria-label="Voltar ao acervo"')
 expect(html).toContain('href="/arq#materiais"')
 expect(html).not.toContain('lesson-workspace-grid grid min-w-0 scroll-mt-28')
 expect(html).not.toContain('aria-label="Produto complementar"')
 expect(html).not.toContain('Seus complementos')
 expect(html).not.toContain('Conteúdos da compra')
 expect(html).toContain('Nenhum conteúdo publicado ainda.')
 expect(html).not.toContain('aria-label="Materiais adquiridos nesta compra"')
})
