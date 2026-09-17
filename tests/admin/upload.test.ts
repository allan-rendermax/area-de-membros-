import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadImage } from '@/lib/data/products-admin'
import nextConfig from '../../next.config'

const { from, upload, getPublicUrl } = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), getPublicUrl: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ storage: { from } }) }))

beforeEach(() => {
  vi.resetAllMocks()
  from.mockReturnValue({ upload, getPublicUrl })
  upload.mockResolvedValue({ error: null })
  getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/capa.png' } })
})

describe('limites de upload', () => {
  it('recusa imagem acima de 2 MB antes de chamar o storage', async () => {
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'capa.png', { type: 'image/png' })
    await expect(uploadImage(file)).rejects.toThrow('Envie uma imagem de até 2 MB.')
    expect(from).not.toHaveBeenCalled()
  })

  it('aceita imagem com exatamente 2 MB', async () => {
    const file = new File([new Uint8Array(2 * 1024 * 1024)], 'capa.png', { type: 'image/png' })
    await expect(uploadImage(file)).resolves.toBe('https://example.com/capa.png')
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), file, { contentType: 'image/png' })
  })

  it('recusa arquivo que não seja imagem com a mensagem atualizada', async () => {
    await expect(uploadImage(new File(['texto'], 'arquivo.txt', { type: 'text/plain' }))).rejects.toThrow('Envie uma imagem de até 2 MB.')
    expect(from).not.toHaveBeenCalled()
  })

  it('limita o corpo das Server Actions a 4.5mb', () => {
    expect(nextConfig.experimental?.serverActions).toMatchObject({ bodySizeLimit: '4.5mb' })
  })

  it.each([
    ['produtos/product-form.tsx', 'Capa (vertical 2:3)'],
    ['produtos/product-form.tsx', 'Banner (horizontal 16:9)'],
    ['lojas/store-form.tsx', 'Logo'],
    ['lojas/store-form.tsx', 'Imagem do login'],
  ])('informa o limite no rótulo %s: %s', (file, label) => {
    const source = readFileSync(new URL(`../../src/app/admin/(painel)/${file}`, import.meta.url), 'utf8')
    expect(source).toContain(`${label} (até 2 MB)`)
  })
})
