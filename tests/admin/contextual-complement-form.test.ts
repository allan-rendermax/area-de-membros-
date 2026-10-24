import { expect,it } from 'vitest'
import { parseProductForm,parseStoreForm } from '@/lib/admin/forms'
const id='00000000-0000-4000-8000-000000000101'
function form(){const f=new FormData();f.set('title','Atlas');return f}
it('preserves absent editorial fields and requires a revision for contextual edits',()=>{
  expect(parseProductForm(form(),'s')).not.toHaveProperty('contextualComplementIds')
  const f=form();f.set('id',id);f.set('contextual_complement_ids','[]')
  expect(()=>parseProductForm(f,'s')).toThrow(/revis|recarregue/i)
  f.set('editorial_revision','3');f.set('catalog_visibility','contextual')
  expect(parseProductForm(f,'s')).toMatchObject({contextualComplementIds:[],expectedEditorialRevision:3,catalogVisibility:'contextual'})
})
it.each(['null','{}','["bad"]',JSON.stringify([id,id])])('rejects invalid complement list %s',value=>{
  const f=form();f.set('contextual_complement_ids',value);expect(()=>parseProductForm(f,'s')).toThrow()
})
it('validates visibility and store mode independently of product role',()=>{
  const f=form();f.set('catalog_visibility','secret');expect(()=>parseProductForm(f,'s')).toThrow()
  const s=new FormData();s.set('name','Arquitetura');s.set('member_library_mode','grouped')
  expect(parseStoreForm(s).memberLibraryMode).toBe('grouped')
  s.set('member_library_mode','all');expect(()=>parseStoreForm(s)).toThrow()
})
