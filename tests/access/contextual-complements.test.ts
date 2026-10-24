import { expect, it } from 'vitest'
import { projectContextualLibrary, projectProductComplements, eligibleContextualParent } from '@/lib/access/contextual-complements'
import { product, relation } from '../fixtures/contextual-products'
const products=[product('atlas'),product('guia',{catalogVisibility:'contextual'}),product('orcamento',{catalogVisibility:'contextual'}),product('novo')]
const relations=[relation('atlas','guia'),relation('atlas','orcamento',1)]
const input={storeId:'s1',products,relations,granted:new Set(['atlas','guia'])}
it('groups acquired complements and keeps optional ones out of discovery',()=>{
  const view=projectContextualLibrary(input)
  expect(view.owned.map(g=>[g.product.id,g.complements.map(p=>p.id)])).toEqual([['atlas',['guia']]])
  expect(view.discovery.map(p=>p.id)).toEqual(['novo'])
  expect([...view.groupByProductId]).toEqual([['atlas','atlas'],['guia','atlas']])
  const detail=projectProductComplements(input,'atlas')
  expect(detail.owned.map(p=>p.id)).toEqual(['guia'])
  expect(detail.optional.map(p=>p.id)).toEqual(['orcamento'])
})
it.each(['lost','unpublished','removed','foreign','unrelated'])('keeps paid standalone discoverable when parent is %s',reason=>{
  const variant={...input, products:products.map(p=>p.id==='atlas' ? {...p,isPublished:reason!=='unpublished',storeId:reason==='foreign'?'s2':'s1'}:p).filter(p=>reason!=='removed'||p.id!=='atlas'),
    granted:new Set(reason==='lost'?['guia']:['atlas','guia']),relations:reason==='unrelated'?[]:relations}
  expect(projectContextualLibrary(variant).owned.find(g=>g.product.id==='guia')?.complements).toEqual([])
  expect(eligibleContextualParent(variant,'guia')).toBeNull()
})
it('requires parent ownership for offers and preserves all acquired complement rights',()=>{
  expect(projectProductComplements({...input,granted:new Set(['guia'])},'atlas').optional).toEqual([])
  expect(projectProductComplements({...input,granted:new Set(['atlas','guia','orcamento'])},'atlas').optional).toEqual([])
  expect(projectContextualLibrary({...input,granted:new Set()}).discovery.map(p=>p.id)).toEqual(['atlas','novo'])
})
it('selects a shared parent deterministically and supports more than three complements',()=>{
  const many=[0,1,2,3].map(n=>product(`c${n}`,{catalogVisibility:'contextual'}))
  const shared={storeId:'s1',products:[product('b'),product('a'),...many],relations:[relation('b','c0'),...many.map((p,n)=>relation('a',p.id,n))],granted:new Set(['a','b',...many.map(p=>p.id)])}
  expect(eligibleContextualParent(shared,'c0')?.id).toBe('a')
  expect(projectContextualLibrary(shared).owned.find(g=>g.product.id==='a')?.complements).toHaveLength(4)
  expect(projectProductComplements(shared,'b').owned.map(p=>p.id)).toEqual(['c0'])
})
it('filters drafts and other stores, deduplicates relations and does not mutate inputs',()=>{
  const variant={...input,products:Object.freeze([...products,product('hidden',{isPublished:false}),product('alien',{storeId:'s2'})]),relations:Object.freeze([...relations,...relations]),granted:new Set(['atlas','guia','hidden','alien'])}
  expect(projectContextualLibrary(variant).owned.map(g=>g.product.id)).toEqual(['atlas'])
  expect(projectProductComplements(variant,'atlas').owned).toHaveLength(1)
  expect(variant.products).toHaveLength(6)
})
it('does not globally hide order bumps or upsells without explicit visibility',()=>{
  const view=projectContextualLibrary({...input,products:[product('legacy',{role:'orderbump'}),product('upsell',{role:'upsell'})],relations:[],granted:new Set()})
  expect(view.discovery.map(p=>p.id)).toEqual(['legacy','upsell'])
})
