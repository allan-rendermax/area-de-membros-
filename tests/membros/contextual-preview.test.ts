import { expect,it } from 'vitest'
import { contextualPreviewRights } from '@/lib/membros/contextual-preview'
import { product,relation } from '../fixtures/contextual-products'
const products=[product('atlas'),product('guia'),product('outro')]
const relations=[relation('atlas','guia'),relation('atlas','outro',1)]
it.each([['none',['atlas']],['one',['atlas','guia']],['all',['atlas','guia','outro']],['solo',['guia','outro']]])('simulates %s without changing real entitlements',(scenario,ids)=>{
  expect([...contextualPreviewRights(products,relations,'complete',scenario as string)]).toEqual(ids)
})
it('never grants when preview is off or simulates locked',()=>{
  expect(contextualPreviewRights(products,relations,false,'all').size).toBe(0)
  expect(contextualPreviewRights(products,relations,'locked','all').size).toBe(0)
})
