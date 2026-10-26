import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { expect, it } from 'vitest'
import { PurchaseNavigationLinks } from '@/components/membros/purchase-navigation'
import { LessonSidebar } from '@/components/membros/lesson-sidebar'
const navigation = { products: [{id:'atlas',title:'Atlas completo + 3 bônus',href:'/arq/produto/atlas?complementos=one',current:false,role:'principal' as const},{id:'guia',title:'Guia de diagnóstico',href:'/arq/produto/guia?complementos=one',current:true,role:'complemento' as const}],backParent:{title:'Atlas completo + 3 bônus',href:'/arq/produto/atlas'}}
it('renders acquired product links and current status without truncating registered names',()=>{
 const document = new Window().document
 document.body.innerHTML=renderToStaticMarkup(createElement(PurchaseNavigationLinks,{navigation}))
 expect(document.querySelectorAll('a')).toHaveLength(2)
 expect(document.querySelector('[aria-current="page"]')?.textContent).toContain('Guia de diagnóstico')
 expect(document.body.textContent).toContain('Principal')
 for(const a of document.querySelectorAll('a')) expect(a.href).toContain('complementos=one')
})
it('keeps navigation outside collapsed module details even without resources',()=>{
 const document=new Window().document
 document.body.innerHTML=renderToStaticMarkup(createElement(LessonSidebar,{modules:[],storeSlug:'arq',purchaseNavigation:navigation}))
 expect(document.body.textContent).toContain('Conteúdos da compra')
 expect(document.querySelector('nav')?.closest('details')).toBeNull()
 expect(document.querySelectorAll('nav a')).toHaveLength(2)
})

it('replaces only the redundant singleton list while retaining multiple modules and progress',()=>{
 const item={id:'item',moduleId:'m',title:'Material',kind:'arquivo',url:'https://example.test/material.pdf',isPublished:true}
 const moduleRow={id:'m',productId:'atlas',title:'Seus materiais',requiredLevel:'basic',isPublished:true,items:[item]}
 const document=new Window().document
 document.body.innerHTML=renderToStaticMarkup(createElement(LessonSidebar,{modules:[moduleRow] as never,storeSlug:'arq',purchaseNavigation:navigation,currentItemId:'item'}))
 expect(document.querySelectorAll('.lesson-module')).toHaveLength(0)
 document.body.innerHTML=renderToStaticMarkup(createElement(LessonSidebar,{modules:[moduleRow,{...moduleRow,id:'second',items:[{...item,id:'other'}]}] as never,storeSlug:'arq',purchaseNavigation:navigation,currentItemId:'item',completedItemIds:['item']}))
 expect(document.querySelectorAll('.lesson-module')).toHaveLength(2)
 expect(document.body.textContent).toContain('Concluído')
 document.body.innerHTML=renderToStaticMarkup(createElement(LessonSidebar,{modules:[moduleRow] as never,storeSlug:'arq'}))
 expect(document.querySelectorAll('.lesson-module')).toHaveLength(1)
 expect(document.querySelector('nav')).toBeNull()
})
