import { expect, it } from 'vitest'
import { PRODUCT_COLUMNS, toProduct, type DbProduct } from '@/lib/data/products'

it('inclui e mapeia o complemento nas consultas de produto', () => {
  const row = { id: 'source', store_id: 'store', slug: 'atlas', title: 'Atlas', track: '', description: '', cover_url: null, banner_url: null, checkout_url: null, role: 'front', student_checkout_url: null, is_featured: false, sort_order: 0, is_published: true }
  const targetId = 'target'
  expect(PRODUCT_COLUMNS).toContain('complementary_product_id')
  expect(toProduct({ ...row, complementary_product_id: targetId } as DbProduct).complementaryProductId).toBe(targetId)
  expect(toProduct(row as DbProduct).complementaryProductId).toBeNull()
})
