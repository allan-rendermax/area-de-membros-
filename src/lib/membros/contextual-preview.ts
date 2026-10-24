import type { Product,ContextualRelation } from '@/lib/domain/types'
import type { ContextualInput } from '@/lib/access/contextual-complements'
import { previewAccessLevel,previewIncludesDrafts,type PreviewContext } from './preview-context'
export type ComplementScenario='none'|'one'|'all'|'solo'
export function contextualPreviewRights(products:readonly Product[],relations:readonly ContextualRelation[],preview:PreviewContext,scenario?:string):Set<string> {
  if(!preview || preview==='locked')return new Set()
  const visible=products.filter(p=>p.isPublished || previewIncludesDrafts(preview))
  const targets=new Set(relations.map(r=>r.complementProductId))
  const choice=['none','one','all','solo'].includes(scenario ?? '')?scenario:previewIncludesDrafts(preview)?'all':'none'
  if(choice==='all')return new Set(visible.map(p=>p.id))
  if(choice==='solo')return new Set(visible.filter(p=>targets.has(p.id) || p.catalogVisibility==='contextual').map(p=>p.id))
  const ids=new Set(visible.filter(p=>!targets.has(p.id) && p.catalogVisibility!=='contextual').map(p=>p.id))
  if(choice==='one'){
    const parents=new Set<string>()
    for(const r of [...relations].sort((a,b)=>a.sortOrder-b.sortOrder || a.complementProductId.localeCompare(b.complementProductId))){
      if(ids.has(r.parentProductId) && !parents.has(r.parentProductId) && visible.some(p=>p.id===r.complementProductId)){
        ids.add(r.complementProductId);parents.add(r.parentProductId)
      }
    }
  }
  return ids
}

// The level selector simulates the main product's version. Selected contextual
// materials with sections simulate a complete purchase of their independent SKU.
// Versioned complements retain the selected version. This never grants real access.
export function contextualPreviewLevel(product: Product, preview: PreviewContext, input?: ContextualInput) {
  const level = previewAccessLevel(preview)
  if (!level || (input && !input.granted.has(product.id))) return undefined
  const isComplement = input && (product.catalogVisibility === 'contextual' || input.relations.some(r => r.storeId === input.storeId && r.complementProductId === product.id))
  return isComplement && product.contentMode !== 'versions' ? 'complete' : level
}
