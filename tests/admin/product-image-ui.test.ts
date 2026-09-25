// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ProductForm } from '@/app/admin/(painel)/produtos/product-form'
import { mockCancelableFormReset } from '../helpers/form-reset'

const io = vi.hoisted(() => ({ prepare: vi.fn(), save: vi.fn(), upload: vi.fn() }))
vi.mock('@/app/admin/(painel)/produtos/actions', () => ({ prepararUploadImagem: io.prepare, salvarProdutoComEstado: io.save }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: io.upload }) } }) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/produtos/novo', useSearchParams: () => new URLSearchParams(), unstable_rethrow: (error: unknown) => { if (error && typeof error === 'object' && 'digest' in error) throw error } }))
let host: HTMLDivElement, root: Root
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.clearAllMocks()
  mockCancelableFormReset()
  io.prepare.mockImplementation(async (_store: string, _product: string, slot: string) => ({ data: { bucket: 'covers', path: `${slot}.png`, token: 'token', publicUrl: `https://example.test/${slot}.png`, receipt: `${slot}-receipt`, supabaseUrl: 'https://example.test', publishableKey: 'public' } }))
  io.upload.mockResolvedValue({ error: null })
  io.save.mockResolvedValue({ status: 'error', fieldErrors: { slug: 'Endereço duplicado' }, message: 'Endereço duplicado' })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(createElement(ProductForm, { product: null, tracks: [], storeId: 'store-a', storeSlug: 'arquitetura' })))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })
const form = () => host.querySelector('form')!
const save = () => host.querySelector<HTMLButtonElement>('button[type=submit]')!
async function choose(index: number, size = 1600000) {
  const input = host.querySelectorAll<HTMLInputElement>('input[type=file]')[index]
  Object.defineProperty(input, 'files', { configurable: true, value: [new File([new Uint8Array(size)], 'mockup.png', { type: 'image/png' })] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}
async function change(name: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`[name="${name}"]`)!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
}

it('quatro imagens de 1,6 MB enviam individualmente e ação final não contém File', async () => {
  await change('title', 'Produto com quatro imagens')
  for (let i = 0; i < 4; i++) await choose(i)
  const data = new FormData(form())
  expect([...data.values()].some(value => value instanceof File)).toBe(false)
  expect(data.get('cover_url')).toBe('https://example.test/cover.png')
  expect(data.get('banner_url')).toBe('https://example.test/banner.png')
  expect(data.get('purchase_image_url')).toBe('https://example.test/purchase.png')
  expect(data.get('upgrade_image_url')).toBe('https://example.test/upgrade.png')
  expect(io.upload).toHaveBeenCalledTimes(4)
  await act(async () => form().requestSubmit())
  expect(io.save).toHaveBeenCalledTimes(1)
  expect(host.textContent).toContain('Endereço duplicado')
  expect(host.querySelector<HTMLInputElement>('[name=title]')!.value).toBe('Produto com quatro imagens')
  expect(new FormData(form()).get('purchase_image_url')).toBe('https://example.test/purchase.png')
})

it('falha no terceiro upload mantém dois anteriores, texto e permite tentar novamente', async () => {
  await change('title', 'Texto ainda não salvo')
  await choose(0); await choose(1)
  io.upload.mockResolvedValueOnce({ error: new Error('offline') })
  await choose(2)
  const data = new FormData(form())
  expect(data.get('cover_url')).toBe('https://example.test/cover.png')
  expect(data.get('banner_url')).toBe('https://example.test/banner.png')
  expect(data.get('purchase_image_url')).toBe('')
  expect(data.get('title')).toBe('Texto ainda não salvo')
  expect(host.textContent).toContain('Não foi possível enviar a imagem')
  const retry = [...host.querySelectorAll('button')].find(button => button.textContent === 'Tentar novamente')!
  await act(async () => retry.click())
  expect(new FormData(form()).get('purchase_image_url')).toBe('https://example.test/purchase.png')
})

it('bloqueia salvar durante upload e rejeita >2 MB sem iniciar outro envio', async () => {
  let finish!: (value: { error: null }) => void
  io.upload.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  await choose(0)
  expect(save().disabled).toBe(true)
  expect(save().textContent).toBe('Enviando imagem…')
  await act(async () => finish({ error: null }))
  expect(save().disabled).toBe(false)
  await choose(1, 2 * 1024 * 1024 + 1)
  expect(io.prepare).toHaveBeenCalledTimes(1)
  expect(host.textContent).toContain('Envie uma imagem de até 2 MB.')
})

it('prévia mostra título e botão do rascunho sem navegação comercial', async () => {
  await change('title', 'Título do rascunho')
  await change('purchase_title', 'Comprar o rascunho')
  await change('purchase_button_text', 'Meu CTA')
  await change('checkout_url', 'https://checkout.example.test/buy')
  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Visualizar modal de produto bloqueado"]')!
  await act(async () => trigger.click())
  const dialog = document.querySelector('[role=dialog]')!
  expect(dialog.textContent).toContain('Comprar o rascunho')
  expect(dialog.textContent).toContain('Meu CTA')
  expect(dialog.querySelector('a[href]')).toBeNull()
  expect(dialog.closest('[data-member-theme]')?.getAttribute('data-member-theme')).toBe('arquitetura')
})

it('salvamento pendente impede clique duplicado e conserva rascunho após falha de rede', async () => {
  await change('title', 'Conservar este título')
  let fail!: (error: Error) => void
  io.save.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject }))
  await act(async () => form().requestSubmit())
  expect(save().disabled).toBe(true)
  expect(save().textContent).toBe('Salvando…')
  await act(async () => save().click())
  expect(io.save).toHaveBeenCalledTimes(1)
  await act(async () => fail(new Error('Conexão indisponível')))
  expect(save().disabled).toBe(false)
  expect(new FormData(form()).get('title')).toBe('Conservar este título')
  expect(host.textContent).toContain('Conexão indisponível')
})

it('limpa aviso de alterações somente após confirmação de sucesso', async () => {
  await change('title', 'Título salvo')
  expect(host.textContent).toContain('Alterações não salvas')
  io.save.mockResolvedValueOnce({ status: 'saved', fieldErrors: {}, message: 'Produto salvo.' })
  await act(async () => form().requestSubmit())
  expect(host.textContent).toContain('Produto salvo.')
  expect(host.textContent).not.toContain('Alterações não salvas')
})
