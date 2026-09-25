import { beforeEach, expect, it, vi } from 'vitest'
import { createProductImageUpload, validateProductImageReference } from '@/lib/data/product-image-uploads'

const io = vi.hoisted(() => ({ signed: vi.fn(), info: vi.fn(), bucket: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ storage: { from: io.bucket } }) }))
const context = { storeId: 'store-a', productId: 'product-a', slot: 'cover' as const }
beforeEach(() => {
  vi.stubEnv('SUPABASE_SECRET_KEY', 'unit-test-secret')
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.test')
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'public-test-key')
  vi.clearAllMocks()
  io.bucket.mockReturnValue({ createSignedUploadUrl: io.signed, info: io.info, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://project.supabase.test/storage/v1/object/public/covers/${path}` } }) })
  io.signed.mockResolvedValue({ data: { token: 'signed-token' }, error: null })
  io.info.mockResolvedValue({ data: { size: 1600000, contentType: 'image/png' }, error: null })
})

it('emite ticket restrito à loja/produto/slot e confirma upload existente', async () => {
  const ticket = await createProductImageUpload(context, 1600000, 'image/png')
  expect(ticket.bucket).toBe('covers')
  expect(ticket.path).toMatch(/^product-drafts\/store-a\/product-a\/cover-[a-f0-9-]+\.png$/)
  await expect(validateProductImageReference(context, ticket.publicUrl, ticket.receipt)).resolves.toBeUndefined()
  expect(io.signed).toHaveBeenCalledWith(ticket.path, { upsert: false })
})
it.each([[2 * 1024 * 1024 + 1, 'image/png'], [0, 'image/png'], [50, 'image/svg+xml']])('recusa tamanho/tipo antes de storage: %s %s', async (size, mime) => {
  await expect(createProductImageUpload(context, size, mime)).rejects.toThrow(/imagem/i)
  expect(io.bucket).not.toHaveBeenCalled()
})
it('recusa comprovante alterado, outra loja/produto/slot e URL externa antes de storage', async () => {
  const ticket = await createProductImageUpload(context, 1600000, 'image/png')
  for (const changed of [{ ...context, storeId: 'other' }, { ...context, productId: 'other' }, { ...context, slot: 'banner' as const }]) {
    await expect(validateProductImageReference(changed, ticket.publicUrl, ticket.receipt)).rejects.toThrow(/imagem/i)
  }
  await expect(validateProductImageReference(context, ticket.publicUrl, `${ticket.receipt}x`)).rejects.toThrow(/imagem/i)
  await expect(validateProductImageReference(context, 'https://other.test/image.png', ticket.receipt)).rejects.toThrow(/imagem/i)
  expect(io.info).not.toHaveBeenCalled()
})
it.each([{ data: null, error: new Error('missing') }, { data: { size: 3000000, contentType: 'image/png' }, error: null }, { data: { size: 1600000, contentType: 'text/html' }, error: null }])('recusa upload ausente ou conteúdo diferente do declarado', async info => {
  const ticket = await createProductImageUpload(context, 1600000, 'image/png')
  io.info.mockResolvedValue(info)
  await expect(validateProductImageReference(context, ticket.publicUrl, ticket.receipt)).rejects.toThrow(/imagem/i)
})
