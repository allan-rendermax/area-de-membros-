import { beforeEach, expect, it, vi } from 'vitest'
import { parseProductForm } from '@/lib/admin/forms'

const io = vi.hoisted(() => ({ saveProduct: vi.fn(), getProductById: vi.fn() }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: async () => {} }))
vi.mock('@/lib/admin/current-store', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/admin/current-store')>()), getAdminStore: async () => ({ id: 'store-a', slug: 'loja' }) }))
vi.mock('@/lib/data/products-admin', () => ({ saveProduct: io.saveProduct, saveItem: vi.fn(), saveModule: vi.fn(), uploadImage: vi.fn().mockResolvedValue('https://example.test/upload.png') }))
vi.mock('@/lib/data/products', () => ({ getProductById: io.getProductById }))
vi.mock('@/lib/admin/product-publication', () => ({ assertProductPublicationReady: async () => {} }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), unstable_cache: <T,>(fn: T) => fn }))
import { salvarItem, salvarModulo, salvarProduto } from '@/app/admin/(painel)/produtos/actions'

const form = (values: Record<string, string>) => {
  const result = new FormData()
  for (const [key, value] of Object.entries({ store_id: 'store-a', title: 'Meu rascunho', ...values })) result.set(key, value)
  return result
}
beforeEach(() => { vi.clearAllMocks(); io.saveProduct.mockResolvedValue('saved') })

it('retorna erro de slug sem redirecionar nem perder campos enviados', async () => {
  const draft = form({ slug: 'Endereço errado', description: 'Texto novo' })
  expect(await salvarProduto(draft)).toMatchObject({ status: 'error', fieldErrors: { slug: expect.any(String) } })
  expect(draft.get('description')).toBe('Texto novo')
  expect(io.saveProduct).not.toHaveBeenCalled()
})
it('mantém o rascunho ao trocar de loja', async () => {
  expect(await salvarProduto(form({ store_id: 'store-antiga' }))).toMatchObject({ status: 'error', message: expect.stringMatching(/loja/i) })
  expect(io.saveProduct).not.toHaveBeenCalled()
})
it('associa slug duplicado ao endereço do produto', async () => {
  io.saveProduct.mockRejectedValueOnce(new Error('Já existe um produto com este endereço nesta loja.'))
  expect(await salvarProduto(form({}))).toMatchObject({ status: 'error', fieldErrors: { slug: expect.any(String) } })
})
it('falha de conexão retorna erro recuperável', async () => {
  io.saveProduct.mockRejectedValueOnce(new Error('Conexão indisponível'))
  expect(await salvarProduto(form({}))).toMatchObject({ status: 'error', message: 'Conexão indisponível' })
})
it('não aceita imagens binárias na ação final', async () => {
  const draft = form({})
  draft.set('cover', new File(['image'], 'cover.png', { type: 'image/png' }))
  expect(await salvarProduto(draft)).toMatchObject({ status: 'error', message: expect.stringMatching(/envio|imagem/i) })
  expect(io.saveProduct).not.toHaveBeenCalled()
})
it('remove mockup de upgrade explicitamente', () => {
  expect(parseProductForm(form({ upgrade_image_url: 'https://example.test/old.png', remove_upgrade_image: 'on' }), 'store-a').upgradeImageUrl).toBeNull()
})

it('confirma edição salva sem redirecionamento para limpar dirty na mesma tela', async () => {
  const id = '00000000-0000-4000-8000-000000000001'
  io.getProductById.mockResolvedValueOnce({ id, storeId: 'store-a' })
  expect(await salvarProduto(form({ id }))).toEqual({ status: 'saved', fieldErrors: {}, message: 'Produto salvo.' })
})

it.each([['módulo', salvarModulo], ['material', salvarItem]])('retorna falha recuperável ao salvar %s inválido', async (_label, action) => {
  const productId = '00000000-0000-4000-8000-000000000001'
  io.getProductById.mockResolvedValueOnce({ id: productId, storeId: 'store-a' })
  expect(await action(form({ product_id: productId, title: '' }))).toMatchObject({ status: 'error', message: expect.any(String) })
})

it.each([['módulo', salvarModulo, 'Módulo salvo.'], ['material', salvarItem, 'Item salvo.']])('retorna confirmação para limpar o estado de %s salvo', async (_label, action, message) => {
  const productId = '00000000-0000-4000-8000-000000000001'
  io.getProductById.mockResolvedValueOnce({ id: productId, storeId: 'store-a' })
  expect(await action(form({ product_id: productId, module_id: productId, kind: 'arquivo', url: 'https://example.test/file.pdf' })))
    .toEqual({ status: 'saved', fieldErrors: {}, message })
})
