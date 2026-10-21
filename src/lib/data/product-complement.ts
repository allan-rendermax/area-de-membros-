import { previewIncludesDrafts, type PreviewContext } from '@/lib/membros/preview-context'
import type { CustomerRow, Product } from '@/lib/domain/types'
import { resolveProductComplement, type ProductComplement } from '@/lib/access/product-complement'
import { loadGrantedProductIds } from './access'
import { getProductById } from './products'

export async function loadProductComplement(source: Product, storeSlug: string, customer: CustomerRow | null, preview: PreviewContext): Promise<ProductComplement | null> {
  if (!source.complementaryProductId || source.complementaryProductId === source.id) return null
  const target = await getProductById(source.complementaryProductId)
  if (!target || target.storeId !== source.storeId || (!previewIncludesDrafts(preview) && !target.isPublished)) return null
  const granted = customer && !preview ? await loadGrantedProductIds(source.storeId, customer) : new Set<string>()
  return resolveProductComplement(source, [target], granted, storeSlug, preview)
}
