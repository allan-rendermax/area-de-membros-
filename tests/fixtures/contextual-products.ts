import type { Product, ContextualRelation } from '@/lib/domain/types'
export function product(id: string, patch: Partial<Product> = {}): Product {
  return { id, storeId:'s1', slug:id, title:id, track:'Atlas Visuais', description:'', coverUrl:null,
    bannerUrl:null, checkoutUrl:null, role:'front', isFeatured:false, sortOrder:0, isPublished:true,
    catalogVisibility:'catalog', ...patch }
}
export function relation(parentProductId: string, complementProductId: string, sortOrder=0): ContextualRelation {
  return {storeId:'s1', parentProductId, complementProductId, sortOrder}
}
