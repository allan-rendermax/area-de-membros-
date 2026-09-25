// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentEditor } from '@/app/admin/(painel)/produtos/content-editor'
import type { ModuleWithItems } from '@/lib/domain/types'
import { mockCancelableFormReset } from '../helpers/form-reset'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const actions = vi.hoisted(() => ({ prepararUploadArquivo: vi.fn(), salvarItem: vi.fn(), salvarModulo: vi.fn(), excluirItem: vi.fn(), excluirModulo: vi.fn(), moverItem: vi.fn(), moverModulo: vi.fn() }))
const upload = vi.hoisted(() => vi.fn())
const bucketFrom = vi.hoisted(() => vi.fn(() => ({ uploadToSignedUrl: upload })))
vi.mock('@/app/admin/(painel)/produtos/actions', () => actions)
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { from: bucketFrom } }) }))

const moduleFixture: ModuleWithItems = { id: 'module-1', productId: 'product-1', title: 'Módulo', sortOrder: 0, isPublished: true, items: [{ id: 'item-1', moduleId: 'module-1', title: 'Apostila', kind: 'arquivo', url: 'https://old.example/file.pdf', coverUrl: null, sortOrder: 0, isPublished: true }] }
const ticket = { path: 'folder/file.pdf', token: 'signed-token', bucket: 'arquivos-restritos', publicUrl: 'https://storage.example/storage/v1/object/authenticated/arquivos-restritos/folder/file.pdf', supabaseUrl: 'https://storage.example', publishableKey: 'publishable-key' }
let container: HTMLDivElement
let root: Root

function formWithButton(label: string) { return [...container.querySelectorAll<HTMLButtonElement>('button[type="submit"]')].find((button) => button.textContent === label)!.closest('form')! }
function itemForm() { return formWithButton('Salvar item') }
function addForm() { return formWithButton('Adicionar item') }
function fileInput(form: HTMLFormElement) { return form.querySelector<HTMLInputElement>('input[type="file"]')! }
async function choose(form: HTMLFormElement, file: File) {
  const input = fileInput(form)
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}

describe('ContentEditor item upload', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockCancelableFormReset()
    actions.prepararUploadArquivo.mockResolvedValue({ data: ticket })
    upload.mockResolvedValue({ data: { path: ticket.path }, error: null })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(createElement(ContentEditor, { productId: 'product-1', productTitle: 'Atlas de teste', modules: [moduleFixture] })))
  })

  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })

  it('sugere Básico e depois Completo com níveis correspondentes; packs mantêm nome livre', async () => {
    const props = { productId: 'product-1', productTitle: 'Atlas', contentMode: 'versions' as const }
    await act(async () => root.render(createElement(ContentEditor, { ...props, modules: [] })))
    expect(new FormData(formWithButton('Criar módulo')).get('title')).toBe('Básico')
    expect(new FormData(formWithButton('Criar módulo')).get('required_level')).toBe('basic')
    await act(async () => root.render(createElement(ContentEditor, { ...props, modules: [moduleFixture] })))
    expect(new FormData(formWithButton('Criar módulo')).get('title')).toBe('Completo')
    expect(new FormData(formWithButton('Criar módulo')).get('required_level')).toBe('complete')
    await act(async () => root.render(createElement(ContentEditor, { ...props, contentMode: 'sections', modules: [moduleFixture] })))
    expect(new FormData(formWithButton('Criar módulo')).get('title')).toBe('')
  })

  it('explica o título visível, o tipo do material e o agrupamento por módulo', () => {
    const form = addForm()
    expect(form.textContent).toContain('nome visível')
    expect(form.textContent).toContain('Link externo')
    expect(form.textContent).toContain('download')
    expect(container.textContent).toContain('mesmo módulo')
  })

  it('mantém título, arquivo enviado e publicação depois de falha ao salvar material', async () => {
    actions.salvarItem.mockResolvedValueOnce({ status: 'error', fieldErrors: {}, message: 'Falha ao salvar material' })
    const form = itemForm()
    const title = form.querySelector<HTMLInputElement>('[name="title"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, 'Título alterado'); title.dispatchEvent(new Event('input', { bubbles: true })) })
    await choose(form, new File(['PDF'], 'novo.pdf', { type: 'application/pdf' }))
    await act(async () => form.requestSubmit())
    expect(form.textContent).toContain('Falha ao salvar material')
    expect(new FormData(form).get('title')).toBe('Título alterado')
    expect(new FormData(form).get('url')).toBe(ticket.publicUrl)
  })

  it('mantém a seção editada e seu nível após erro de persistência', async () => {
    actions.salvarModulo.mockResolvedValueOnce({ status: 'error', fieldErrors: {}, message: 'Não foi possível salvar seção' })
    const section = [...container.querySelectorAll('form')].find(form => form.textContent?.includes('Nome da seção'))!
    const title = section.querySelector<HTMLInputElement>('[name="title"]')!
    const level = section.querySelector<HTMLSelectElement>('[name="required_level"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, 'Seção editada')
      title.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { level.value = 'complete'; level.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(new FormData(section).get('required_level')).toBe('complete')
    await act(async () => section.requestSubmit())
    expect(section.textContent).toContain('Não foi possível salvar seção')
    expect(new FormData(section).get('title')).toBe('Seção editada')
    expect(new FormData(section).get('required_level')).toBe('complete')
  })

  it('após erro e sucesso, limpa novo material e impede reenviar o mesmo item', async () => {
    actions.salvarItem.mockResolvedValueOnce({ status: 'error', fieldErrors: {}, message: 'Falha temporária' })
      .mockResolvedValueOnce({ status: 'saved', fieldErrors: {}, message: 'Item salvo.' })
    const form = addForm()
    await choose(form, new File(['PDF'], 'novo.pdf', { type: 'application/pdf' }))
    await act(async () => form.requestSubmit())
    expect(new FormData(form).get('url')).toBe(ticket.publicUrl)
    expect(form.textContent).toContain('Falha temporária')
    await act(async () => form.requestSubmit())
    expect(form.textContent).toContain('Item salvo.')
    expect(form.textContent).not.toContain('Falha temporária')
    expect(form.textContent).not.toContain('Arquivo enviado')
    expect(new FormData(form).get('url')).toBe('')
    expect(new FormData(form).get('title')).toBe('Atlas de teste')
    await act(async () => form.requestSubmit())
    expect(actions.salvarItem).toHaveBeenCalledTimes(2)
  })

  it('sucesso na edição conserva material atualizado e remove erro anterior', async () => {
    actions.salvarItem.mockResolvedValueOnce({ status: 'error', fieldErrors: {}, message: 'Erro anterior' })
      .mockResolvedValueOnce({ status: 'saved', fieldErrors: {}, message: 'Item salvo.' })
    const form = itemForm()
    await choose(form, new File(['PDF'], 'atualizado.pdf', { type: 'application/pdf' }))
    await act(async () => form.requestSubmit())
    expect(form.textContent).toContain('Erro anterior')
    await act(async () => form.requestSubmit())
    expect(form.querySelector('[role="alert"]')).toBeNull()
    expect(form.textContent).toContain('Item salvo.')
    expect(new FormData(form).get('url')).toBe(ticket.publicUrl)
    expect(new FormData(form).get('title')).toBe('Apostila')
  })

  it.each([false, true])('sucesso depois de erro em seção: edição=%s', async existing => {
    actions.salvarModulo.mockResolvedValueOnce({ status: 'error', fieldErrors: {}, message: 'Erro anterior da seção' })
      .mockResolvedValueOnce({ status: 'saved', fieldErrors: {}, message: 'Módulo salvo.' })
    const form = existing ? [...container.querySelectorAll('form')].find(form => form.textContent?.includes('Nome da seção'))! : formWithButton('Criar módulo')
    const input = form.querySelector<HTMLInputElement>('[name="title"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Seção nova'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => form.requestSubmit())
    expect(new FormData(form).get('title')).toBe('Seção nova')
    await act(async () => form.requestSubmit())
    expect(form.querySelector('[role="alert"]')).toBeNull()
    expect(form.textContent).toContain('Módulo salvo.')
    expect(new FormData(form).get('title')).toBe(existing ? 'Seção nova' : '')
    if (!existing) {
      await act(async () => form.requestSubmit())
      expect(actions.salvarModulo).toHaveBeenCalledTimes(2)
    }
  })

  it('preenche novos materiais com o produto e preserva nomes personalizados existentes', () => {
    expect(addForm().querySelector<HTMLInputElement>('[name="title"]')?.value).toBe('Atlas de teste')
    expect(itemForm().querySelector<HTMLInputElement>('[name="title"]')?.value).toBe('Apostila')
    expect(addForm().textContent).toContain('Nome do material')
    expect(addForm().textContent).toContain('Por padrão, usamos o nome do produto')
  })

  it('mostra o produto como padrão de item genérico e permite gravar outro nome pelo campo existente', async () => {
    const genericModule = { ...moduleFixture, items: [{ ...moduleFixture.items[0], id: 'generic-item', title: 'Clique Aqui' }] }
    await act(async () => root.render(createElement(ContentEditor, { productId: 'product-1', productTitle: 'Atlas de teste', modules: [genericModule] })))
    const input = itemForm().querySelector<HTMLInputElement>('[name="title"]')!
    expect(input.value).toBe('Atlas de teste')
    expect(container.textContent).not.toContain('Clique Aqui')
    input.value = 'Plantas editáveis'
    expect(new FormData(itemForm()).get('title')).toBe('Plantas editáveis')
  })

  it('uploads a selected file to its ticket bucket and leaves its reference URL editable', async () => {
    const form = itemForm()
    const input = fileInput(form)
    expect(input.name).toBe('')
    expect(form.querySelector<HTMLButtonElement>('button[type="button"]')?.textContent).toContain('Enviar arquivo')
    await choose(form, new File(['PDF'], 'apostila.pdf', { type: 'application/pdf' }))
    expect(bucketFrom).toHaveBeenCalledWith('arquivos-restritos')
    const url = form.querySelector<HTMLInputElement>('input[name="url"]')!
    expect(url.value).toBe(ticket.publicUrl)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(url, 'https://manual.example/arquivo.pdf')
      url.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => root.render(createElement(ContentEditor, { productId: 'product-1', productTitle: 'Atlas de teste', modules: [moduleFixture] })))
    expect(url.value).toBe('https://manual.example/arquivo.pdf')
  })

  it('rejects invalid files locally without changing the existing URL', async () => {
    const form = itemForm()
    await choose(form, new File(['x'], 'malware.exe'))
    expect(form.querySelector('[role="alert"]')?.textContent).toMatch(/PDF|ZIP/)
    expect(form.querySelector<HTMLInputElement>('input[name="url"]')?.value).toBe('https://old.example/file.pdf')
    expect(actions.prepararUploadArquivo).not.toHaveBeenCalled()
    expect([...form.querySelectorAll('button')].some((button) => button.textContent?.includes('Tentar novamente'))).toBe(false)
  })

  it('clears an earlier success message when the next file is invalid', async () => {
    const form = itemForm()
    await choose(form, new File(['PDF'], 'apostila.pdf'))
    expect(form.querySelector('[role="status"]')?.textContent).toContain('Arquivo enviado')
    await choose(form, new File(['x'], 'malware.exe'))
    expect(form.querySelector('[role="status"]')).toBeNull()
    expect(form.querySelector('[role="alert"]')?.textContent).toMatch(/PDF|ZIP/)
    expect(form.querySelector<HTMLInputElement>('input[name="url"]')?.value).toBe(ticket.publicUrl)
  })

  it('rejects files above 50 MB before asking for a ticket', async () => {
    const form = itemForm()
    const oversized = new File(['x'], 'apostila.pdf')
    Object.defineProperty(oversized, 'size', { value: 50 * 1024 * 1024 + 1 })
    await choose(form, oversized)
    expect(form.querySelector('[role="alert"]')?.textContent).toContain('50 MB')
    expect(form.querySelector<HTMLInputElement>('input[name="url"]')?.value).toBe('https://old.example/file.pdf')
    expect(actions.prepararUploadArquivo).not.toHaveBeenCalled()
  })

  it('preserves the URL and offers retry when ticket preparation fails', async () => {
    actions.prepararUploadArquivo.mockResolvedValueOnce({ error: 'Não foi possível preparar o envio do arquivo. Tente novamente.' })
    const form = itemForm()
    await choose(form, new File(['PDF'], 'apostila.pdf'))
    expect(form.querySelector('[role="alert"]')?.textContent).toContain('preparar')
    expect(form.querySelector<HTMLInputElement>('input[name="url"]')?.value).toBe('https://old.example/file.pdf')
    const retry = [...form.querySelectorAll('button')].find((button) => button.textContent?.includes('Tentar novamente'))!
    await act(async () => retry.click())
    expect(form.querySelector<HTMLInputElement>('input[name="url"]')?.value).toBe(ticket.publicUrl)
  })

  it('keeps the previous URL after a failed upload and retries the same file', async () => {
    upload.mockResolvedValueOnce({ data: null, error: new Error('storage failed') })
    const form = itemForm()
    await choose(form, new File(['PDF'], 'apostila.pdf'))
    expect(form.querySelector('[role="alert"]')?.textContent).toMatch(/envio|arquivo|Tente/i)
    expect(form.querySelector<HTMLInputElement>('input[name="url"]')?.value).toBe('https://old.example/file.pdf')
    const retry = [...form.querySelectorAll('button')].find((button) => button.textContent?.includes('Tentar novamente'))!
    await act(async () => retry.click())
    expect(form.querySelector<HTMLInputElement>('input[name="url"]')?.value).toBe(ticket.publicUrl)
  })

  it('blocks submit, including Enter, while upload is pending', async () => {
    let finishUpload!: (value: { data: { path: string }; error: null }) => void
    upload.mockReturnValue(new Promise((resolve) => { finishUpload = resolve }))
    const form = addForm()
    const input = fileInput(form)
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['PDF'], 'apostila.pdf')] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await Promise.resolve() })
    expect(form.querySelector('[role="status"]')?.textContent).toMatch(/Enviando|Preparando/)
    expect(form.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
    const submit = new Event('submit', { bubbles: true, cancelable: true })
    await act(async () => form.dispatchEvent(submit))
    expect(submit.defaultPrevented).toBe(true)
    expect(actions.salvarItem).not.toHaveBeenCalled()
    await act(async () => finishUpload({ data: { path: ticket.path }, error: null }))
  })
})
