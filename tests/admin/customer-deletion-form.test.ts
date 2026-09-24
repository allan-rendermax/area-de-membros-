// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeleteCustomerSection } from '@/app/admin/(painel)/clientes/delete-customer-form'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const action = vi.hoisted(() => vi.fn())
vi.mock('@/app/admin/(painel)/clientes/actions', () => ({ excluirCliente: action }))
let container: HTMLDivElement
let root: Root
const customer = { id: 'customer-a', email: 'cliente@example.test' }

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
  action.mockResolvedValue({ error: 'Não foi possível excluir o cliente.' })
  await act(async () => root.render(createElement(DeleteCustomerSection, { customer })))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('confirmação da exclusão de cliente', () => {
  it('exige abrir confirmação e digitar o e-mail antes de habilitar exclusão', async () => {
    expect(container.querySelector('form')).toBeNull()
    await act(async () => button('Excluir cliente').click())
    const input = container.querySelector<HTMLInputElement>('input[name="confirmation"]')!
    expect(input.labels?.[0]?.textContent).toContain('e-mail do cliente')
    expect(document.activeElement).toBe(input)
    expect(button('Excluir definitivamente').disabled).toBe(true)
    await typeName('errado@example.test')
    expect(button('Excluir definitivamente').disabled).toBe(true)
    await typeName('cliente@example.test')
    expect(button('Excluir definitivamente').disabled).toBe(false)
    expect(action).not.toHaveBeenCalled()
  })
  it('cancelar limpa confirmação, não exclui e devolve foco ao botão', async () => {
    await act(async () => button('Excluir cliente').click())
    await typeName('cliente@example.test')
    await act(async () => button('Cancelar').click())
    expect(container.querySelector('form')).toBeNull()
    expect(document.activeElement).toBe(button('Excluir cliente'))
    expect(action).not.toHaveBeenCalled()
    await act(async () => button('Excluir cliente').click())
    expect(container.querySelector<HTMLInputElement>('input[name="confirmation"]')!.value).toBe('')
  })
  it('envia cliente e confirmação, mostra erro do servidor e permite cancelar', async () => {
    await act(async () => button('Excluir cliente').click())
    await typeName('cliente@example.test')
    await act(async () => button('Excluir definitivamente').click())
    expect(action).toHaveBeenCalledOnce()
    const form = action.mock.calls[0][1] as FormData
    expect(Object.fromEntries(form)).toEqual({ id: 'customer-a', confirmation: 'cliente@example.test' })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('cliente')
    expect(button('Cancelar').disabled).toBe(false)
  })
  it('bloqueia reenvio e cancelamento enquanto a operação está em andamento', async () => {
    let finish!: (state: { error: string | null }) => void
    action.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await act(async () => button('Excluir cliente').click())
    await typeName('cliente@example.test')
    await act(async () => button('Excluir definitivamente').click())
    expect(button('Excluindo…').disabled).toBe(true)
    expect(button('Cancelar').disabled).toBe(true)
    await act(async () => button('Excluindo…').click())
    expect(action).toHaveBeenCalledOnce()
    await act(async () => finish({ error: 'Não foi possível excluir.' }))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível excluir')
  })
})
