import { beforeEach, describe, expect, it, vi } from 'vitest'

const io = vi.hoisted(() => ({
  requireAdmin: vi.fn(), getAdminStore: vi.fn(), getProductById: vi.fn(),
  from: vi.fn(), createSignedUploadUrl: vi.fn(), getPublicUrl: vi.fn(),
}))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: io.requireAdmin }))
vi.mock('@/lib/admin/current-store', () => ({ getAdminStore: io.getAdminStore }))
vi.mock('@/lib/data/products', () => ({ getProductById: io.getProductById }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ storage: { from: io.from } }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`) } }))

import { prepararUploadArquivo } from '@/app/admin/(painel)/produtos/actions'
import { createItemUpload } from '@/lib/data/products-admin'

const productId = '0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c'
const storeId = '1b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c'
const max = 50 * 1024 * 1024

beforeEach(() => {
  vi.resetAllMocks()
  process.env.SUPABASE_URL = 'https://project.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-test'
  process.env.SUPABASE_SECRET_KEY = 'secret-test'
  io.requireAdmin.mockResolvedValue({ email: 'admin@example.com' })
  io.getAdminStore.mockResolvedValue({ id: storeId, slug: 'loja' })
  io.getProductById.mockResolvedValue({ id: productId, storeId })
  io.from.mockReturnValue({ createSignedUploadUrl: io.createSignedUploadUrl, getPublicUrl: io.getPublicUrl })
  io.createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: 'https://project.supabase.co/storage/v1/object/upload/sign/arquivos/path?token=test', path: 'path', token: 'signed-token' }, error: null })
  io.getPublicUrl.mockImplementation((path: string) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/arquivos/${path}` } }))
})

describe('assinatura de arquivo de item', () => {
  it('não assina para visitante sem admin', async () => {
    io.requireAdmin.mockImplementation(() => { throw new Error('NEXT_REDIRECT:/admin/entrar') })
    await expect(prepararUploadArquivo(productId, 'a.pdf', 1)).rejects.toThrow('NEXT_REDIRECT:/admin/entrar')
    expect(io.from).not.toHaveBeenCalled()
  })

  it('não assina produto de outra loja', async () => {
    io.getProductById.mockResolvedValue({ id: productId, storeId: 'outra-loja' })
    await expect(prepararUploadArquivo(productId, 'a.pdf', 1)).rejects.toThrow('NEXT_REDIRECT:/admin/produtos')
    expect(io.from).not.toHaveBeenCalled()
  })

  it.each(['a.exe', 'a.pdf.exe', 'sem-extensao', '', '../.pdf'])('recusa nome inválido %j', async (name) => {
    const result = await prepararUploadArquivo(productId, name, 1)
    expect(result.error).toMatch(/arquivo|extens[aã]o|nome/i)
    expect(io.from).not.toHaveBeenCalled()
  })

  it.each([NaN, -1, 0, Infinity, max + 1, 1.5])('recusa tamanho inválido %s', async (size) => {
    const result = await prepararUploadArquivo(productId, 'a.pdf', size)
    expect(result.error).toMatch(/tamanho|50 MB/i)
    expect(io.from).not.toHaveBeenCalled()
  })

  it('aceita exatamente 50 MB e devolve somente credenciais públicas', async () => {
    const result = await prepararUploadArquivo(productId, 'Material.PDF', max)
    expect(result.error).toBeUndefined()
    expect(result.data).toMatchObject({
      token: 'signed-token', supabaseUrl: 'https://project.supabase.co', publishableKey: 'publishable-test',
      path: expect.stringMatching(/^[0-9a-f-]{36}\/Material\.PDF$/),
      publicUrl: expect.stringMatching(/^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/arquivos\//),
    })
    expect(JSON.stringify(result)).not.toContain('secret-test')
    expect(io.from).toHaveBeenCalledWith('arquivos')
    expect(io.createSignedUploadUrl).toHaveBeenCalledWith(result.data?.path, { upsert: false })
  })

  it('cria pastas distintas para nomes iguais e remove caminho e caracteres perigosos', async () => {
    const first = await prepararUploadArquivo(productId, '../../Meus arquivos/Relatório final.PDF', 123)
    const second = await prepararUploadArquivo(productId, '../../Meus arquivos/Relatório final.PDF', 123)
    expect(first.data?.path).toMatch(/^[0-9a-f-]{36}\/Relatorio_final\.PDF$/)
    expect(second.data?.path).toMatch(/^[0-9a-f-]{36}\/Relatorio_final\.PDF$/)
    expect(first.data?.path).not.toBe(second.data?.path)
  })

  it.each([
    ['á.pdf', 'a.pdf'],
    ['你好.pdf', 'arquivo.pdf'],
  ])('assina nome Unicode válido %s com nome de caminho seguro', async (name, sanitized) => {
    const result = await prepararUploadArquivo(productId, name, 1)
    expect(result.data?.path).toMatch(new RegExp(`^[0-9a-f-]{36}/${sanitized.replace('.', '\\.')}$`))
  })

  it('recusa parte do nome composta apenas por espaços', async () => {
    const result = await prepararUploadArquivo(productId, '   .pdf', 1)
    expect(result.error).toMatch(/nome|arquivo/i)
    expect(io.from).not.toHaveBeenCalled()
  })

  it('retorna erro em português quando Storage falha', async () => {
    io.createSignedUploadUrl.mockResolvedValue({ data: null, error: new Error('Storage unavailable') })
    const result = await prepararUploadArquivo(productId, 'a.zip', 42)
    expect(result).toEqual({ error: expect.stringMatching(/n[aã]o foi poss[ií]vel|tente novamente/i) })
    expect(JSON.stringify(result)).not.toContain('Storage unavailable')
  })
})

describe('validação compartilhada', () => {
  it('aceita extensões permitidas sem distinguir maiúsculas', async () => {
    const { validateItemUpload } = await import('@/lib/admin/item-upload')
    for (const ext of ['pdf', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg']) {
      expect(validateItemUpload(`arquivo.${ext.toUpperCase()}`, 1)).toBeNull()
    }
  })
})

it('o helper de dados também recusa tamanho inválido antes de acessar Storage', async () => {
  await expect(createItemUpload('arquivo.pdf', max + 1)).rejects.toThrow(/50 MB/)
  expect(io.from).not.toHaveBeenCalled()
})
