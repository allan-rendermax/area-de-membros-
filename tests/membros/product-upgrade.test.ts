// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { ProductUpgrade } from '@/components/membros/product-upgrade'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div'); document.body.append(container)
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })

it('abre mockup quadrado com CTA personalizado, fecha por Escape e restaura foco', () => {
  act(() => root.render(createElement(ProductUpgrade, { level: 'basic', lockedCount: 1, productTitle: 'Atlas', imageUrl: 'https://example.com/mockup.jpg', checkoutUrl: 'https://checkout.example.com/upgrade', buttonText: 'Liberar meu Atlas', refreshHref: '/arquitetura/produto/atlas' })))
  const trigger = container.querySelector('button')!
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  trigger.focus(); act(() => trigger.click())
  const modal = document.querySelector('[role="dialog"]')!
  expect(modal.querySelector('.aspect-square img')?.getAttribute('src')).toBe('https://example.com/mockup.jpg')
  const checkout = modal.querySelector<HTMLAnchorElement>('a[target="_blank"]')!
  expect(checkout.href).toBe('https://checkout.example.com/upgrade')
  expect(checkout.textContent).toContain('Liberar meu Atlas')
  expect(checkout.className).toContain('motion-safe:hover:scale-[1.03]')
  expect(checkout.rel).toBe('noopener noreferrer')
  act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it('não cria checkout inválido; oferece suporte e fecha pelo botão', () => {
  act(() => root.render(createElement(ProductUpgrade, { level: 'basic', lockedCount: 1, checkoutUrl: 'javascript:alert(1)', refreshHref: '/produto' })))
  act(() => container.querySelector('button')!.click())
  const modal = document.querySelector('[role="dialog"]')!
  expect(modal.textContent).toContain('entre em contato com o suporte')
  expect(modal.querySelector('a[target="_blank"]')).toBeNull()
  act(() => modal.querySelector<HTMLButtonElement>('[aria-label="Fechar"]')!.click())
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('não oferece upgrade a quem já tem Completo', () => {
  act(() => root.render(createElement(ProductUpgrade, { level: 'complete', lockedCount: 1, refreshHref: '/produto' })))
  expect(container.textContent).toBe('')
})

it('prévia mantém o CTA visual sem checkout ou atualização de acesso navegáveis', () => {
  act(() => root.render(createElement(ProductUpgrade, { level: 'basic', lockedCount: 1, previewOnly: true, checkoutUrl: 'https://checkout.example.com/upgrade', refreshHref: '/produto', buttonText: 'Meu botão de teste' })))
  act(() => container.querySelector('button')!.click())
  const modal = document.querySelector('[role="dialog"]')!
  expect(modal.textContent).toContain('Meu botão de teste')
  expect(modal.querySelector('a[href]')).toBeNull()
  expect(modal.textContent).not.toContain('Já paguei')
})
