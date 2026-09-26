// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OfferGroupForm } from '@/app/admin/(painel)/ofertas/offer-group-form'
import type { AdminOfferGroup } from '@/lib/data/offer-groups'
import type { Product } from '@/lib/domain/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const action = vi.hoisted(() => vi.fn())
vi.mock('@/app/admin/(painel)/ofertas/group-actions', () => ({ salvarGrupoOferta: action }))
const product: Product = { id: 'product-1', storeId: 'store-1', slug: 'atlas', title: 'Atlas', track: '', description: '', coverUrl: null, bannerUrl: null, checkoutUrl: null, role: 'front', isFeatured: false, sortOrder: 0, isPublished: true }
let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.clearAllMocks()
  action.mockResolvedValue({ error: 'ID já cadastrado em outro plano.' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
async function render(offer: AdminOfferGroup | null = null, initialCode = '', products = [product]) {
  await act(async () => root.render(createElement(OfferGroupForm, { offer, products, storeId: 'store-1', initialCode })))
}
function button(label: string) {
  const el = [...container.querySelectorAll('button')].find(b => b.textContent === label)
  if (!el) throw new Error(`Botão ausente: ${label}`)
  return el
}
async function change(selector: string, value: string) {
  const el = container.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!
  await act(async () => {
    if (el instanceof HTMLInputElement) Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event(el instanceof HTMLInputElement ? 'input' : 'change', { bubbles: true }))
  })
}
function plans() { return JSON.parse(container.querySelector<HTMLInputElement>('input[name="plans"]')!.value) }
async function addProduct(planIndex = 0, title = 'Atlas') {
  const section = container.querySelectorAll('[data-plan]')[planIndex]
  const add = [...section.querySelectorAll('button')].find(b => b.textContent?.includes('Adicionar produto'))!
  await act(async () => add.click())
  const inputs = section.querySelectorAll<HTMLInputElement>('[role="combobox"]')
  await act(async () => inputs[inputs.length - 1].focus())
  const option = [...section.querySelectorAll<HTMLElement>('[role="option"]')].find(o => o.textContent === title)!
  await act(async () => option.click())
}

describe('cadastro de uma oferta com vários planos', () => {
  it('começa com Básico e Completo e permite adicionar nomes livres', async () => {
    await render()
    expect(plans().map((p: { name: string }) => p.name)).toEqual(['Básico', 'Completo'])
    await act(async () => button('Adicionar plano').click())
    expect(container.querySelectorAll('[data-plan]')).toHaveLength(3)
    await change('[name="plan_name_2"]', 'Combo')
    expect(plans()[2].name).toBe('Combo')
  })
  it('cada plano tem produtos adicionados e níveis independentes; remover linha retira a liberação', async () => {
    await render()
    expect(container.querySelectorAll('[data-grant]')).toHaveLength(0)
    await addProduct(0)
    await addProduct(1)
    await change('[data-plan]:nth-of-type(2) [data-grant] select', 'complete')
    expect(plans()[0].grants).toEqual([{ productId: 'product-1', level: 'basic' }])
    expect(plans()[1].grants).toEqual([{ productId: 'product-1', level: 'complete' }])
    expect([...container.querySelector<HTMLSelectElement>('[data-grant] select')!.options].map(o => o.value)).toEqual(['basic', 'complete'])
    await act(async () => container.querySelector<HTMLButtonElement>('[data-grant] button[aria-label^="Remover produto"]')!.click())
    expect(plans()[0].grants).toEqual([])
    expect(plans()[1].grants).toEqual([{ productId: 'product-1', level: 'complete' }])
  })
  it('remover plano exige confirmação e mantém os dados dos demais planos', async () => {
    await render()
    await change('[name="plan_code_1"]', 'COMPLETE')
    const remove = container.querySelector<HTMLButtonElement>('[data-plan] button')!
    await act(async () => remove.click())
    expect(plans()).toHaveLength(2)
    await act(async () => button('Confirmar remoção').click())
    expect(plans()).toHaveLength(1)
    expect(plans()[0].paytProductCode).toBe('COMPLETE')
    expect(container.querySelector<HTMLButtonElement>('[data-plan] button')!.disabled).toBe(true)
  })
  it('preserva IDs, versão, seleção e códigos imutáveis na edição', async () => {
    await render({ id: 'group-1', name: 'Atlas', version: 7, plans: [{ id: 'plan-1', name: 'Básico', paytProductCode: 'BASIC', grants: [{ productId: 'product-1', level: 'basic' }] }] })
    expect(container.querySelector<HTMLInputElement>('[name="plan_code_0"]')!.readOnly).toBe(true)
    expect(container.querySelector<HTMLInputElement>('[name="version"]')!.value).toBe('7')
    expect(container.querySelector<HTMLInputElement>('[name="store_id"]')!.value).toBe('store-1')
    expect(plans()[0].id).toBe('plan-1')
    expect(container.querySelector<HTMLInputElement>('[role="combobox"]')!.value).toBe('Atlas')
    expect(container.querySelector<HTMLSelectElement>('[data-grant] select')!.value).toBe('basic')
  })
  it('preenche código de compra pendente em um único plano editável', async () => {
    await render(null, 'PENDING')
    expect(plans()).toHaveLength(1)
    expect(plans()[0].paytProductCode).toBe('PENDING')
    expect(container.querySelector<HTMLInputElement>('[name="plan_code_0"]')!.readOnly).toBe(false)
  })
  it('mantém preenchimento após erro e bloqueia alterações enquanto salva', async () => {
    await render(null, 'PENDING')
    await change('[name="name"]', 'Minha oferta')
    await addProduct()
    await change('[data-grant] select', 'complete')
    let finish!: (value: { error: string }) => void
    action.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await act(async () => container.querySelector<HTMLInputElement>('[role="combobox"]')!.click())
    await act(async () => button('Salvar oferta').click())
    expect(action).toHaveBeenCalledOnce()
    expect(button('Salvando…').disabled).toBe(true)
    expect(container.querySelector('fieldset')!.disabled).toBe(true)
    expect(container.querySelector('[role="listbox"]')).toBeNull()
    await act(async () => finish({ error: 'ID já cadastrado em outro plano.' }))
    expect(container.querySelector('[role="listbox"]')).toBeNull()
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('ID já cadastrado')
    expect(container.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe('Minha oferta')
    expect(plans()[0].paytProductCode).toBe('PENDING')
    expect(plans()[0].grants).toEqual([{ productId: 'product-1', level: 'complete' }])
  })
  it('permite desfazer remoção bloqueada sem perder as outras alterações', async () => {
    await render({ id: 'group-1', name: 'Atlas', version: 1, plans: [
      { id: 'plan-1', name: 'Básico', paytProductCode: 'BASIC', grants: [{ productId: 'product-1', level: 'basic' }] },
      { id: 'plan-2', name: 'Completo', paytProductCode: 'COMPLETE', grants: [{ productId: 'product-1', level: 'complete' }] },
    ] })
    await change('[name="name"]', 'Atlas editado')
    await act(async () => container.querySelector<HTMLButtonElement>('[data-plan] button')!.click())
    await act(async () => button('Confirmar remoção').click())
    action.mockResolvedValue({ error: 'Este plano possui pedidos.' })
    await act(async () => button('Salvar oferta').click())
    await act(async () => button('Restaurar plano').click())
    expect(plans().find((p: { id: string }) => p.id === 'plan-1')).toMatchObject({ paytProductCode: 'BASIC', grants: [{ productId: 'product-1', level: 'basic' }] })
    expect(container.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe('Atlas editado')
  })
  it('mostra apenas liberações existentes em um catálogo de 60 produtos e busca sem acentos', async () => {
    const products = [product, ...Array.from({ length: 59 }, (_, i) => ({ ...product, id: `other-${i}`, title: i === 58 ? 'Orçamento de Obras' : `Produto ${i}` }))]
    await render({ id: 'group-1', name: 'Atlas', version: 1, plans: [{ id: 'plan-1', name: 'Básico', paytProductCode: 'BASIC', grants: [{ productId: 'product-1', level: 'basic' }] }] }, '', products)
    expect(container.querySelectorAll('[data-grant]')).toHaveLength(1)
    expect(container.querySelector('[role="listbox"]')).toBeNull()
    await act(async () => container.querySelector<HTMLInputElement>('[role="combobox"]')!.focus())
    await change('[role="combobox"]', 'orcamento')
    expect([...container.querySelectorAll('[role="option"]')].map(o => o.textContent)).toEqual(['Orçamento de Obras'])
    await act(async () => container.querySelector<HTMLElement>('[role="option"]')!.click())
    expect(plans()[0].grants).toEqual([{ productId: 'other-58', level: 'basic' }])
  })
  it('impede produto repetido no mesmo plano e preserva nível ao trocar ou remover linhas', async () => {
    await render(null, 'ONE', [product, { ...product, id: 'product-2', title: 'Cozinhas' }, { ...product, id: 'product-3', title: 'Fundações' }])
    await addProduct()
    await addProduct(0, 'Cozinhas')
    await change('[data-grant]:nth-child(2) select', 'complete')
    await act(async () => container.querySelectorAll<HTMLInputElement>('[role="combobox"]')[1].click())
    expect([...container.querySelectorAll('[role="option"]')].map(o => o.textContent)).toEqual(['Cozinhas', 'Fundações'])
    await act(async () => [...container.querySelectorAll<HTMLElement>('[role="option"]')].find(o => o.textContent === 'Fundações')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[data-grant] button[aria-label^="Remover produto"]')!.click())
    expect(plans()[0].grants).toEqual([{ productId: 'product-3', level: 'complete' }])
    expect(container.querySelector<HTMLInputElement>('[role="combobox"]')!.value).toBe('Fundações')
  })
  it('adiciona linha vazia sem liberar automaticamente e exige selecionar da lista', async () => {
    await render(null, 'ONE')
    await change('[name="name"]', 'Oferta')
    await act(async () => button('+ Adicionar produto').click())
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!
    expect(input.value).toBe('')
    expect(input.checkValidity()).toBe(false)
    await act(async () => input.focus())
    await change('[role="combobox"]', 'Produto inexistente')
    expect(container.querySelector('[role="option"]')).toBeNull()
    expect(container.textContent).toContain('Nenhum produto encontrado')
    expect(input.checkValidity()).toBe(false)
    await act(async () => button('Salvar oferta').click())
    expect(action).not.toHaveBeenCalled()
    expect(plans()[0].grants[0].productId).toBe('')
  })
  it('permite pesquisar e selecionar por teclado, cancelar e sair sem alterar a seleção', async () => {
    await render(null, 'ONE', [product, { ...product, id: 'product-2', title: 'Cozinhas' }])
    await act(async () => button('+ Adicionar produto').click())
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!
    await act(async () => input.focus())
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(plans()[0].grants).toEqual([{ productId: 'product-1', level: 'basic' }])
    expect(input.getAttribute('aria-expanded')).toBe('false')
    await change('[role="combobox"]', 'cozinha')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(input.value).toBe('Atlas')
    expect(plans()[0].grants).toEqual([{ productId: 'product-1', level: 'basic' }])
    await change('[role="combobox"]', 'cozinha')
    await act(async () => input.blur())
    expect(input.value).toBe('Atlas')
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })
  it('mantém a seleção existente válida enquanto a busca está aberta', async () => {
    await render({ id: 'group-1', name: 'Atlas', version: 1, plans: [{ id: 'plan-1', name: 'Básico', paytProductCode: 'BASIC', grants: [{ productId: 'product-1', level: 'basic' }] }] })
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!
    await act(async () => input.focus())
    expect(input.value).toBe('')
    expect(input.checkValidity()).toBe(true)
    await act(async () => button('Salvar oferta').click())
    expect(action).toHaveBeenCalledOnce()
    expect(plans()[0].grants).toEqual([{ productId: 'product-1', level: 'basic' }])
  })
  it('orienta quando não há produtos e bloqueia adição e salvamento', async () => {
    await render(null, 'ONE', [])
    expect(container.textContent).toContain('Cadastre produtos nesta loja primeiro')
    expect(button('+ Adicionar produto').disabled).toBe(true)
    expect(button('Salvar oferta').disabled).toBe(true)
  })
})
