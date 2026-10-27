import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect,it } from 'vitest'
import { ResourceList } from '@/components/membros/resource-list'
import type { Item } from '@/lib/domain/types'
it('preserves the October 19 PDF label and action with the protected opening destination',()=>{
 const item={id:'guia',title:'Material',kind:'arquivo',url:'https://example.test/doc.pdf',isPublished:true} as Item
 const html=renderToStaticMarkup(createElement(ResourceList,{items:[item],storeSlug:'arq',productTitle:'Guia de diagnóstico'}))
 expect(html).toContain('Acesse seu conteúdo');expect(html).toContain('>PDF</span>');expect(html).toContain('/arq/item/guia/abrir')
})
