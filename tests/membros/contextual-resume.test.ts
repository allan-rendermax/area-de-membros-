import { expect,it } from 'vitest'
import { product,relation } from '../fixtures/contextual-products'
import { projectContextualLibrary } from '@/lib/access/contextual-complements'
import { projectContextualResume,resolveContextualRequest } from '@/lib/membros/contextual-library'
const input={storeId:'s1',products:[product('atlas'),product('guia',{catalogVisibility:'contextual',contentMode:'versions'})],relations:[relation('atlas','guia')],granted:new Set(['atlas','guia'])}
const visits=[{productId:'guia',itemId:'i-full',accessedAt:'2026-10-24T13:00Z',availableItem:{requiredLevel:'complete' as const}},
  {productId:'guia',itemId:'i-basic',accessedAt:'2026-10-24T12:00Z',availableItem:{requiredLevel:'basic' as const}}]
it('resumes the latest authorized item under the parent cover without duplicates',()=>{
  const cards=projectContextualResume(input,projectContextualLibrary(input),visits,new Map([['atlas','complete'],['guia','basic']]),'arq')
  expect(cards.map(c=>[c.product.id,c.materialTitle,c.href])).toEqual([['atlas','guia','/arq/item/i-basic']])
})
it('never inherits basic into complete versions and has a safe acquired fallback',()=>{
  const cards=projectContextualResume(input,projectContextualLibrary(input),visits.slice(1),new Map([['guia','complete']]),'arq')
  expect(cards[0].href).toBe('/arq/produto/guia')
  expect(projectContextualResume({...input,granted:new Set()},projectContextualLibrary({...input,granted:new Set()}),visits,new Map(),'arq')).toEqual([])
})
it('resolves old links into contextual offers only for an eligible parent',()=>{
  expect(resolveContextualRequest(input,'guia','arq')).toEqual({kind:'owned',href:'/arq/produto/guia'})
  expect(resolveContextualRequest({...input,granted:new Set(['atlas'])},'guia','arq')).toEqual({kind:'offer',href:'/arq/produto/atlas?complemento=guia#complementos'})
  expect(resolveContextualRequest({...input,granted:new Set()},'guia','arq')).toEqual({kind:'unavailable'})
  expect(resolveContextualRequest({...input,relations:[],granted:new Set(['atlas'])},'guia','arq')).toEqual({kind:'unavailable'})
  expect(resolveContextualRequest(input,'atlas','arq')).toEqual({kind:'legacy'})
})
