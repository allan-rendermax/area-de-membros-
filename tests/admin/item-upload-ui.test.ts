// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentEditor } from '@/app/admin/(painel)/produtos/content-editor'
import type { ModuleWithItems } from '@/lib/domain/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const actions = vi.hoisted(() => ({ prepararUploadArquivo: vi.fn(), salvarItem: vi.fn(), salvarModulo: vi.fn(), excluirItem: vi.fn(), excluirModulo: vi.fn(), moverItem: vi.fn(), moverModulo: vi.fn() }))
const upload = vi.hoisted(() => vi.fn())
vi.mock('@/app/admin/(painel)/produtos/actions', () => actions)
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: upload }) } }) }))

const moduleFixture: ModuleWithItems = { id: 'module-1', productId: 'product-1', title: 'Módulo', sortOrder: 0, isPublished: true, items: [{ id: 'item-1', moduleId: 'module-1', title: 'Apostila', kind: 'arquivo', url: 'https://old.example/file.pdf', coverUrl: null, sortOrder: 0, isPublished: true }] }
const ticket = { path: 'folder/file.pdf', token: 'signed-token', publicUrl: 'https://public.example/file.pdf', supabaseUrl: 'https://storage.example', publishableKey: 'publishable-key' }
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
    actions.prepararUploadArquivo.mockResolvedValue({ data: ticket })
    upload.mockResolvedValue({ data: { path: ticket.path }, error: null })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(createElement(ContentEditor, { productId: 'product-1', modules: [moduleFixture] })))
  })

  afterEach(async () => { await act(async () => root.unmount()); container.remove() })

  it('explica o título visível, o tipo do material e o agrupamento por módulo', () => {
    const form = addForm()
    expect(form.textContent).toContain('nome visível')
    expect(form.textContent).toContain('Link externo')
    expect(form.textContent).toContain('download')
    expect(container.textContent).toContain('mesmo módulo')
  })

  it('uploads a selected file and leaves its public URL editable', async () => {
    const form = itemForm()
    const input = fileInput(form)
    expect(input.name).toBe('')
    expect(form.querySelector<HTMLButtonElement>('button[type="button"]')?.textContent).toContain('Enviar arquivo')
    await choose(form, new File(['PDF'], 'apostila.pdf', { type: 'application/pdf' }))
    const url = form.querySelector<HTMLInputElement>('input[name="url"]')!
    expect(url.value).toBe(ticket.publicUrl)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(url, 'https://manual.example/arquivo.pdf')
      url.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => root.render(createElement(ContentEditor, { productId: 'product-1', modules: [moduleFixture] })))
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
