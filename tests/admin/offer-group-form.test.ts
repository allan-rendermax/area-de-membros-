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
async function render(offer: AdminOfferGroup | null = null, initialCode = '') {
  await act(async () => root.render(createElement(OfferGroupForm, { offer, products: [product], storeId: 'store-1', initialCode })))
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

describe('cadastro de uma oferta com vários planos', () => {
  it('começa com Básico e Completo e permite adicionar nomes livres', async () => {
    await render()
    expect(plans().map((p: { name: string }) => p.name)).toEqual(['Básico', 'Completo'])
    await act(async () => button('Adicionar plano').click())
    expect(container.querySelectorAll('[data-plan]')).toHaveLength(3)
    await change('[name="plan_name_2"]', 'Combo')
    expect(plans()[2].name).toBe('Combo')
  })
  it('cada plano libera seu próprio nível; só oferece Básico/Completo e nenhum acesso', async () => {
    await render()
    await change('[name="grant_0_product-1"]', 'basic')
    await change('[name="grant_1_product-1"]', 'complete')
    expect(plans()[0].grants).toEqual([{ productId: 'product-1', level: 'basic' }])
    expect(plans()[1].grants).toEqual([{ productId: 'product-1', level: 'complete' }])
    expect([...container.querySelector<HTMLSelectElement>('[name="grant_0_product-1"]')!.options].map(o => o.value)).toEqual(['', 'basic', 'complete'])
    await change('[name="grant_0_product-1"]', '')
    expect(plans()[0].grants).toEqual([])
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
    expect(container.querySelector<HTMLSelectElement>('[name="grant_0_product-1"]')!.value).toBe('basic')
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
    await change('[name="grant_0_product-1"]', 'complete')
    let finish!: (value: { error: string }) => void
    action.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await act(async () => button('Salvar oferta').click())
    expect(action).toHaveBeenCalledOnce()
    expect(button('Salvando…').disabled).toBe(true)
    expect(container.querySelector('fieldset')!.disabled).toBe(true)
    await act(async () => finish({ error: 'ID já cadastrado em outro plano.' }))
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
})
