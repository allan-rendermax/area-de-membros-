import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect,it,vi } from 'vitest'
import { Window } from 'happy-dom'
import { OwnedProductGroup } from '@/components/membros/owned-product-group'
import { ContextualComplementShelves } from '@/components/membros/contextual-complement-shelves'
import { product } from '../fixtures/contextual-products'
vi.mock('next/navigation',()=>({usePathname:()=>'/arq/produto/atlas',useSearchParams:()=>new URLSearchParams(),useRouter:()=>({refresh:()=>{}})}))
const atlas=product('atlas',{coverUrl:'https://example.test/atlas.webp'})
const guia=product('guia',{coverUrl:'https://example.test/guia-portrait.webp',purchaseImageUrl:'https://example.test/guia-square.webp'})
it('renders acquired parent and complement covers as independent links',()=>{
  const html=renderToStaticMarkup(createElement(OwnedProductGroup,{group:{product:atlas,complements:[guia]},storeSlug:'arq',preview:false}))
  const doc=new Window().document;doc.body.innerHTML=html
  expect(doc.querySelector('details')).toBeNull()
  expect([...doc.querySelectorAll('a')].map(a=>a.getAttribute('href'))).toEqual(['/arq/produto/atlas','/arq/produto/guia'])
  expect(doc.body.children).toHaveLength(2)
  expect(doc.querySelectorAll('img')).toHaveLength(2)
})
it('preserves preview and complement scenario on every acquired cover',()=>{
  const html=renderToStaticMarkup(createElement(OwnedProductGroup,{group:{product:atlas,complements:[guia]},storeSlug:'arq',preview:'complete',complementScenario:'all'}))
  const doc=new Window().document;doc.body.innerHTML=html
  expect([...doc.querySelectorAll('a')].map(a=>a.getAttribute('href'))).toEqual([
    '/arq/produto/atlas?previa=1&simular=complete&complementos=all',
    '/arq/produto/guia?previa=1&simular=complete&complementos=all',
  ])
})
it('does not create empty shelves and separates purchased from optional materials',()=>{
  const html=renderToStaticMarkup(createElement(ContextualComplementShelves,{complements:{owned:[atlas],optional:[guia],backParent:null},storeSlug:'arq',preview:false}))
  const doc=new Window().document;doc.body.innerHTML=html
  expect(doc.querySelector('[aria-label="Seus complementos"] a')?.getAttribute('href')).toBe('/arq/produto/atlas')
  expect(doc.querySelector('[aria-label="Complemente seu material"]')?.textContent).toContain('Vendido separadamente')
  expect(doc.querySelector('[aria-label="Complemente seu material"] img')?.getAttribute('src')).toContain('guia-portrait')
  expect(renderToStaticMarkup(createElement(ContextualComplementShelves,{complements:{owned:[],optional:[],backParent:null},storeSlug:'arq',preview:false}))).toBe('')
})
it('makes the existing acquired-material text a link without adding purchase navigation',()=>{
  const html=renderToStaticMarkup(createElement(ContextualComplementShelves,{complements:{owned:[guia],optional:[],backParent:atlas},storeSlug:'arq',preview:'complete',complementScenario:'one'}))
  const doc=new Window().document;doc.body.innerHTML=html
  const link=Array.from(doc.querySelectorAll('a')).find(a=>a.textContent==='Acessar material')
  expect(link?.getAttribute('href')).toBe('/arq/produto/guia?previa=1&simular=complete&complementos=one')
  expect(doc.querySelector('nav[aria-label="Materiais adquiridos nesta compra"]')).toBeNull()
  expect(doc.querySelectorAll('[aria-label="Seus complementos"]')).toHaveLength(1)
})
