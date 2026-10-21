import { beforeEach, expect, it, vi } from 'vitest'
import { parseProductForm } from '@/lib/admin/forms'
import { saveProduct } from '@/lib/data/products-admin'

const database = vi.hoisted(() => ({ createAdminClient: vi.fn(), insert: vi.fn(), update: vi.fn(), target: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: database.createAdminClient }))
const targetId = '0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c'

beforeEach(() => {
  vi.clearAllMocks()
  const result = { data: { id: 'saved' }, error: null }
  const write = { select: () => ({ single: async () => result }), eq: () => ({ eq: () => ({ select: () => ({ single: async () => result }) }) }) }
  database.createAdminClient.mockReturnValue({ from: (table: string) => table === 'products' ? {
    insert: (row: unknown) => { database.insert(row); return write },
    update: (row: unknown) => { database.update(row); return write },
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: database.target(), error: null }) }) }) }),
  } : null })
})

it('lê um UUID de complemento, rejeita valor inválido e permite limpar', () => {
  const form = new FormData()
  form.set('title', 'Atlas')
  form.set('complementary_product_id', targetId)
  expect(parseProductForm(form, 'store-a').complementaryProductId).toBe(targetId)
  form.set('complementary_product_id', 'invalid')
  expect(() => parseProductForm(form, 'store-a')).toThrow()
  form.set('complementary_product_id', '')
  expect(parseProductForm(form, 'store-a').complementaryProductId).toBeNull()
})

it('verifica loja e autorreferência antes de gravar; omissão preserva o vínculo', async () => {
  const form = new FormData()
  form.set('title', 'Atlas')
  const base = parseProductForm(form, 'store-a')
  database.target.mockReturnValue({ id: targetId, store_id: 'store-a' })
  await saveProduct({ ...base, complementaryProductId: targetId })
  expect(database.insert).toHaveBeenCalledWith(expect.objectContaining({ complementary_product_id: targetId }))
  database.target.mockReturnValue(null)
  await expect(saveProduct({ ...base, complementaryProductId: targetId })).rejects.toThrow()
  database.target.mockReturnValue({ id: targetId, store_id: 'store-a' })
  await expect(saveProduct({ ...base, id: targetId, complementaryProductId: targetId })).rejects.toThrow()
  await saveProduct(base)
  expect(database.insert).toHaveBeenLastCalledWith(expect.not.objectContaining({ complementary_product_id: expect.anything() }))
})
