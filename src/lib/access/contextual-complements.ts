import type { Product, ContextualRelation } from '@/lib/domain/types'

export type ContextualInput = {
  storeId: string; products: readonly Product[]; relations: readonly ContextualRelation[]
  granted: ReadonlySet<string>; includeDrafts?: boolean
}
export type OwnedGroup = { product: Product; complements: Product[] }
export type LibraryProjection = { owned: OwnedGroup[]; discovery: Product[]; groupByProductId: Map<string,string> }
export type ProductComplements = { owned: Product[]; optional: Product[]; backParent: Product | null }
const editorialOrder = (a: Product,b: Product) => a.sortOrder-b.sortOrder || a.id.localeCompare(b.id)
function visible(input: ContextualInput): Product[] {
  return input.products.filter(p=>p.storeId===input.storeId && (p.isPublished || input.includeDrafts)).sort(editorialOrder)
}
export function eligibleContextualParent(input: ContextualInput, complementId: string): Product | null {
  const products=visible(input)
  if (!products.some(p=>p.id===complementId)) return null
  const parentIds=new Set(input.relations.filter(r=>r.storeId===input.storeId && r.complementProductId===complementId && r.parentProductId!==complementId).map(r=>r.parentProductId))
  return products.find(p=>parentIds.has(p.id) && input.granted.has(p.id)) ?? null
}
function children(input: ContextualInput,parentId: string): Product[] {
  const byId=new Map(visible(input).map(p=>[p.id,p]))
  const seen=new Set<string>()
  return input.relations.filter(r=>r.storeId===input.storeId && r.parentProductId===parentId && r.complementProductId!==parentId)
    .sort((a,b)=>a.sortOrder-b.sortOrder || a.complementProductId.localeCompare(b.complementProductId))
    .flatMap(r=>{
      const p=byId.get(r.complementProductId)
      if (!p || seen.has(p.id)) return []
      seen.add(p.id); return [p]
    })
}
export function projectContextualLibrary(input: ContextualInput): LibraryProjection {
  const products=visible(input)
  const acquired=products.filter(p=>input.granted.has(p.id))
  const groupByProductId=new Map<string,string>()
  for (const product of acquired) groupByProductId.set(product.id,eligibleContextualParent(input,product.id)?.id ?? product.id)
  const owned=acquired.filter(p=>groupByProductId.get(p.id)===p.id).map(product=>({
    product, complements:children(input,product.id).filter(p=>input.granted.has(p.id) && groupByProductId.get(p.id)===product.id),
  }))
  return {owned,groupByProductId,discovery:products.filter(p=>p.catalogVisibility!=='contextual' && !input.granted.has(p.id))}
}
export function projectProductComplements(input: ContextualInput,parentId: string): ProductComplements {
  const backParent=eligibleContextualParent(input,parentId)
  if (!input.granted.has(parentId) || !visible(input).some(p=>p.id===parentId)) return {owned:[],optional:[],backParent}
  const related=children(input,parentId)
  return {owned:related.filter(p=>input.granted.has(p.id)),optional:related.filter(p=>!input.granted.has(p.id)),backParent}
}
