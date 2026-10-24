import type { AccessLevel,Product } from '@/lib/domain/types'
import { eligibleContextualParent, type ContextualInput,type LibraryProjection } from '@/lib/access/contextual-complements'
import { canAccessProductModule } from '@/lib/access/product-content'
import type { RecentProductVisitWithAccess } from '@/lib/data/item-access'
export type ResumeCard={product:Product;materialTitle:string;href:string}
const productHref=(store:string,slug:string)=>`/${encodeURIComponent(store)}/produto/${encodeURIComponent(slug)}`
export function projectContextualResume(input:ContextualInput,projection:LibraryProjection,
  visits:readonly RecentProductVisitWithAccess[],levels:ReadonlyMap<string,AccessLevel>,storeSlug:string):ResumeCard[] {
  const byId=new Map(input.products.filter(p=>p.storeId===input.storeId && p.isPublished && input.granted.has(p.id)).map(p=>[p.id,p]))
  const groups=new Map<string,{product:Product;visits:RecentProductVisitWithAccess[]}>()
  for (const visit of visits) {
    const product=byId.get(visit.productId)
    if(!product)continue
    const groupId=projection.groupByProductId.get(product.id) ?? product.id
    const group=groups.get(groupId) ?? {product:byId.get(groupId) ?? product,visits:[]}
    group.visits.push(visit);groups.set(groupId,group)
  }
  return [...groups.values()].map(group=>{
    const authorized=group.visits.find(v=>v.availableItem && canAccessProductModule(levels.get(v.productId),v.availableItem.requiredLevel,byId.get(v.productId)?.contentMode))
    const visit=authorized ?? group.visits[0]
    const material=byId.get(visit.productId)!
    return {product:group.product,materialTitle:material.title,href:authorized?`/${encodeURIComponent(storeSlug)}/item/${encodeURIComponent(visit.itemId)}`:productHref(storeSlug,material.slug)}
  })
}
export type ContextualRequest={kind:'owned'|'offer';href:string}|{kind:'unavailable'}|{kind:'legacy'}
export function resolveContextualRequest(input:ContextualInput,slug:string,storeSlug:string):ContextualRequest {
  const product=input.products.find(p=>p.storeId===input.storeId && p.slug===slug)
  if(!product || product.catalogVisibility!=='contextual')return {kind:'legacy'}
  if(!product.isPublished && !input.includeDrafts)return {kind:'unavailable'}
  if(input.granted.has(product.id))return {kind:'owned',href:productHref(storeSlug,product.slug)}
  const parent=eligibleContextualParent(input,product.id)
  return parent?{kind:'offer',href:`${productHref(storeSlug,parent.slug)}?complemento=${encodeURIComponent(product.slug)}#complementos`}:{kind:'unavailable'}
}
