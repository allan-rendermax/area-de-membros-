// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeleteProductSection } from '@/app/admin/(painel)/produtos/delete-product-form'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const action = vi.hoisted(() => vi.fn())
vi.mock('@/app/admin/(painel)/produtos/actions', () => ({ excluirProduto: action }))
let container: HTMLDivElement
let root: Root
const product = { id: 'product-a', title: 'Produto de teste' }

function button(text: string) {
  const found = [...container.querySelectorAll('button')].find(b => b.textContent === text)
  if (!found) throw new Error(`Botão ausente: ${text}`)
  return found
}
async function typeName(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[name="confirmation"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
beforeEach(async () => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  action.mockResolvedValue({ error: 'Produto vinculado a uma oferta.' })
  await act(async () => root.render(createElement(DeleteProductSection, { product, storeId: 'store-a' })))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('confirmação da exclusão de produto', () => {
  it('exige abrir confirmação e digitar o nome antes de habilitar exclusão', async () => {
    expect(container.querySelector('form')).toBeNull()
    await act(async () => button('Excluir produto').click())
    const input = container.querySelector<HTMLInputElement>('input[name="confirmation"]')!
    expect(input.labels?.[0]?.textContent).toContain('nome do produto')
    expect(document.activeElement).toBe(input)
    expect(button('Excluir definitivamente').disabled).toBe(true)
    await typeName('Nome errado')
    expect(button('Excluir definitivamente').disabled).toBe(true)
    await typeName('Produto de teste')
    expect(button('Excluir definitivamente').disabled).toBe(false)
    expect(action).not.toHaveBeenCalled()
  })
  it('cancelar limpa confirmação, não exclui e devolve foco ao botão', async () => {
    await act(async () => button('Excluir produto').click())
    await typeName('Produto de teste')
    await act(async () => button('Cancelar').click())
    expect(container.querySelector('form')).toBeNull()
    expect(document.activeElement).toBe(button('Excluir produto'))
    expect(action).not.toHaveBeenCalled()
    await act(async () => button('Excluir produto').click())
    expect(container.querySelector<HTMLInputElement>('input[name="confirmation"]')!.value).toBe('')
  })
  it('envia produto e loja, mostra bloqueio do servidor e mantém possibilidade de cancelar', async () => {
    await act(async () => button('Excluir produto').click())
    await typeName('Produto de teste')
    await act(async () => button('Excluir definitivamente').click())
    expect(action).toHaveBeenCalledOnce()
    const form = action.mock.calls[0][1] as FormData
    expect(Object.fromEntries(form)).toEqual({ id: 'product-a', store_id: 'store-a', confirmation: 'Produto de teste' })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('oferta')
    expect(button('Cancelar').disabled).toBe(false)
  })
  it('bloqueia reenvio e cancelamento enquanto a operação está em andamento', async () => {
    let finish!: (state: { error: string | null }) => void
    action.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await act(async () => button('Excluir produto').click())
    await typeName('Produto de teste')
    await act(async () => button('Excluir definitivamente').click())
    expect(button('Excluindo…').disabled).toBe(true)
    expect(button('Cancelar').disabled).toBe(true)
    await act(async () => button('Excluindo…').click())
    expect(action).toHaveBeenCalledOnce()
    await act(async () => finish({ error: 'Não foi possível excluir.' }))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível excluir')
  })
})
