import { beforeEach, expect, it, vi } from 'vitest'
import { parseProductForm } from '@/lib/admin/forms'
import { saveProduct } from '@/lib/data/products-admin'

const database = vi.hoisted(() => ({ createAdminClient: vi.fn(), insert: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: database.createAdminClient }))

beforeEach(() => {
  vi.clearAllMocks()
  const result = { data: { id: 'saved' }, error: null }
  const select = () => ({ single: async () => result })
  database.createAdminClient.mockReturnValue({ from: () => ({
    insert: (row: unknown) => { database.insert(row); return { select } },
    update: (row: unknown) => { database.update(row); return { eq: () => ({ eq: () => ({ select }) }) } },
  }) })
})

it('grava role no insert e no update do produto', async () => {
  const create = new FormData()
  create.set('title', 'Bônus')
  create.set('role', 'orderbump')
  create.set('checkout_url', 'https://payt.example/bump')
  await saveProduct(parseProductForm(create, 'store-a'))
  expect(database.insert).toHaveBeenCalledWith(expect.objectContaining({ role: 'orderbump' }))

  const edit = new FormData()
  edit.set('id', '0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c')
  edit.set('title', 'Bônus')
  edit.set('role', 'upsell')
  edit.set('checkout_url', 'https://payt.example/upsell')
  await saveProduct(parseProductForm(edit, 'store-a'))
  expect(database.update).toHaveBeenCalledWith(expect.objectContaining({ role: 'upsell' }))
})
