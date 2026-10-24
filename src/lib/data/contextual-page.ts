import type { Product } from '@/lib/domain/types'
import type { ContextualInput } from '@/lib/access/contextual-complements'
import { resolveProductComplement } from '@/lib/access/product-complement'
import { previewIncludesDrafts,type PreviewContext } from '@/lib/membros/preview-context'
import { contextualPreviewRights } from '@/lib/membros/contextual-preview'
import { listProducts } from './products'
import { listContextualRelations } from './contextual-complements'
export async function loadContextualInput(storeId:string,granted:ReadonlySet<string>,preview:PreviewContext,scenario?:string):Promise<ContextualInput> {
  const [products,result]=await Promise.all([listProducts(storeId),listContextualRelations(storeId)])
  return {storeId,products,relations:result.relations,granted:preview?contextualPreviewRights(products,result.relations,preview,scenario):granted,includeDrafts:previewIncludesDrafts(preview)}
}
export function contextualLegacyComplement(input:ContextualInput,product:Product,storeSlug:string,preview:PreviewContext) {
  const target=input.products.find(p=>p.id===product.complementaryProductId)
  if(!target || target.catalogVisibility==='contextual' || input.relations.some(r=>r.parentProductId===product.id && r.complementProductId===target.id))return null
  return resolveProductComplement(product,[...input.products],new Set(input.granted),storeSlug,preview)
}
