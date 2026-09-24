// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeleteOfferSection } from '@/app/admin/(painel)/ofertas/delete-offer-form'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const action = vi.hoisted(() => vi.fn())
vi.mock('@/app/admin/(painel)/ofertas/actions', () => ({ excluirOferta: action }))
let container: HTMLDivElement
let root: Root
const offer = { id: 'offer-a', name: 'Oferta de teste' }

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
  action.mockResolvedValue({ error: 'Esta oferta possui pedidos.' })
  await act(async () => root.render(createElement(DeleteOfferSection, { offer, storeId: 'store-a' })))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('confirmação da exclusão de oferta', () => {
  it('exige abrir confirmação e digitar o nome antes de habilitar exclusão', async () => {
    expect(container.querySelector('form')).toBeNull()
    await act(async () => button('Excluir oferta').click())
    const input = container.querySelector<HTMLInputElement>('input[name="confirmation"]')!
    expect(input.labels?.[0]?.textContent).toContain('nome da oferta')
    expect(document.activeElement).toBe(input)
    expect(button('Excluir definitivamente').disabled).toBe(true)
    await typeName('Nome errado')
    expect(button('Excluir definitivamente').disabled).toBe(true)
    await typeName('Oferta de teste')
    expect(button('Excluir definitivamente').disabled).toBe(false)
    expect(action).not.toHaveBeenCalled()
  })
  it('cancelar limpa confirmação, não exclui e devolve foco ao botão', async () => {
    await act(async () => button('Excluir oferta').click())
    await typeName('Oferta de teste')
    await act(async () => button('Cancelar').click())
    expect(container.querySelector('form')).toBeNull()
    expect(document.activeElement).toBe(button('Excluir oferta'))
    expect(action).not.toHaveBeenCalled()
    await act(async () => button('Excluir oferta').click())
    expect(container.querySelector<HTMLInputElement>('input[name="confirmation"]')!.value).toBe('')
  })
  it('envia oferta e loja, mostra bloqueio do servidor e mantém possibilidade de cancelar', async () => {
    await act(async () => button('Excluir oferta').click())
    await typeName('Oferta de teste')
    await act(async () => button('Excluir definitivamente').click())
    expect(action).toHaveBeenCalledOnce()
    const form = action.mock.calls[0][1] as FormData
    expect(Object.fromEntries(form)).toEqual({ id: 'offer-a', store_id: 'store-a', confirmation: 'Oferta de teste' })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('oferta')
    expect(button('Cancelar').disabled).toBe(false)
  })
  it('bloqueia reenvio e cancelamento enquanto a operação está em andamento', async () => {
    let finish!: (state: { error: string | null }) => void
    action.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await act(async () => button('Excluir oferta').click())
    await typeName('Oferta de teste')
    await act(async () => button('Excluir definitivamente').click())
    expect(button('Excluindo…').disabled).toBe(true)
    expect(button('Cancelar').disabled).toBe(true)
    await act(async () => button('Excluindo…').click())
    expect(action).toHaveBeenCalledOnce()
    await act(async () => finish({ error: 'Não foi possível excluir.' }))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível excluir')
  })
})
