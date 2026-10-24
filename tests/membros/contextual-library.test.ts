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
it('renders accessible acquired shortcuts outside the parent link',()=>{
  const html=renderToStaticMarkup(createElement(OwnedProductGroup,{group:{product:atlas,complements:[guia]},storeSlug:'arq',preview:false}))
  const doc=new Window().document;doc.body.innerHTML=html
  expect(doc.querySelectorAll('details a')).toHaveLength(1)
  expect(doc.querySelector('details a')?.getAttribute('href')).toBe('/arq/produto/guia')
  expect(doc.querySelector('a details')).toBeNull()
  expect(doc.querySelector('summary')?.textContent).toContain('1 complemento adquirido')
})
it('does not create empty shelves and separates purchased from optional materials',()=>{
  const html=renderToStaticMarkup(createElement(ContextualComplementShelves,{complements:{owned:[atlas],optional:[guia],backParent:null},storeSlug:'arq',preview:false}))
  const doc=new Window().document;doc.body.innerHTML=html
  expect(doc.querySelector('[aria-label="Seus complementos"] a')?.getAttribute('href')).toBe('/arq/produto/atlas')
  expect(doc.querySelector('[aria-label="Complemente seu material"]')?.textContent).toContain('Vendido separadamente')
  expect(doc.querySelector('[aria-label="Complemente seu material"] img')?.getAttribute('src')).toContain('guia-portrait')
  expect(renderToStaticMarkup(createElement(ContextualComplementShelves,{complements:{owned:[],optional:[],backParent:null},storeSlug:'arq',preview:false}))).toBe('')
})
