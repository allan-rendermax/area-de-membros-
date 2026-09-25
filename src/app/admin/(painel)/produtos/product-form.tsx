import type { Product } from '@/lib/domain/types'
import { ProductFormEditor } from './product-form-editor'

export type ProductFormProps = { product: Product | null; tracks: string[]; storeId: string; storeSlug?: string; supportUrl?: string | null; upgradeSectionName?: string }

export function ProductForm(props: ProductFormProps) {
  return <ProductFormEditor key={`${props.storeId}:${props.product?.id ?? 'new'}`} {...props} />
}
