// @vitest-environment happy-dom
import { act, createElement, StrictMode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Modal } from '@/components/membros/modal'

let root: Root
let container: HTMLDivElement
let mounted: boolean
let close = vi.fn<() => void>()
function render(open = true) {
  act(() => root.render(createElement(Modal, { open, onClose: close, labelledBy: 'title' },
    createElement('h2', { id: 'title' }, 'Detalhes'),
    createElement('button', { disabled: true }, 'Indisponível'),
    createElement('div', { style: { display: 'none' } }, createElement('button', null, 'Oculto')),
    createElement('button', null, 'Primeiro'), createElement('a', { href: '/continuar' }, 'Último'),
  )))
}
function unmount() { act(() => root.unmount()); mounted = false }
function press(key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  act(() => document.activeElement!.dispatchEvent(event))
  return event
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  mounted = true
  close = vi.fn()
})
afterEach(() => {
  if (mounted) unmount()
  container.remove()
  vi.restoreAllMocks()
  document.body.removeAttribute('style')
})

describe('Modal lifecycle e teclado', () => {
  it('ignora controles desabilitados e ancestrais invisíveis ao definir foco', () => {
    render()
    expect(document.activeElement?.textContent).toBe('Primeiro')
    const last = document.querySelector<HTMLAnchorElement>('[role="dialog"] a')!
    last.focus()
    press('Tab')
    expect(document.activeElement?.textContent).toBe('Primeiro')
    press('Tab', true)
    expect(document.activeElement).toBe(last)
  })
  it('mantém foco e fecha só no backdrop, nunca ao clicar no conteúdo', () => {
    render()
    const panel = document.querySelector<HTMLElement>('[role="dialog"]')!
    act(() => panel.querySelector('h2')!.click())
    expect(close).not.toHaveBeenCalled()
    act(() => panel.parentElement!.click())
    expect(close).toHaveBeenCalledTimes(1)
    press('Escape')
    expect(close).toHaveBeenCalledTimes(2)
  })
  it('restaura scroll e inert originais ao desmontar e remove handlers', () => {
    document.body.style.overflow = 'scroll'
    document.body.style.position = 'relative'
    container.inert = true
    const scroll = vi.spyOn(window, 'scrollTo')
    render()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.position).toBe('fixed')
    unmount()
    expect(document.body.style.overflow).toBe('scroll')
    expect(document.body.style.position).toBe('relative')
    expect(container.inert).toBe(true)
    expect(scroll).toHaveBeenCalledWith(window.scrollX, window.scrollY)
    press('Escape')
    expect(close).not.toHaveBeenCalled()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
  it('restaura foco do acionador real inclusive em StrictMode e ao reabrir', () => {
    function Example() {
      const [open, setOpen] = useState(false)
      return createElement('div', null,
        createElement('button', { onClick: () => setOpen(true) }, 'Abrir'),
        createElement(Modal, { open, onClose: () => setOpen(false), labelledBy: 'example' },
          createElement('h2', { id: 'example' }, 'Exemplo'),
          createElement('button', { onClick: () => setOpen(false) }, 'Fechar'),
        ),
      )
    }
    act(() => root.render(createElement(StrictMode, null, createElement(Example))))
    const trigger = container.querySelector('button')!
    for (let index = 0; index < 2; index++) {
      trigger.focus()
      act(() => trigger.click())
      expect(document.activeElement?.textContent).toBe('Fechar')
      expect(container.inert).toBe(true)
      press('Escape')
      expect(document.activeElement).toBe(trigger)
      expect(container.inert).toBe(false)
    }
  })
  it('foca o painel e contém Tab quando não existem controles', () => {
    act(() => root.render(createElement(Modal, { open: true, onClose: close, labelledBy: 'empty' }, createElement('h2', { id: 'empty' }, 'Texto'))))
    const panel = document.querySelector('[role="dialog"]')
    expect(document.activeElement).toBe(panel)
    expect(press('Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(panel)
  })
})

describe('recuperação de navegação', () => {
  it('oferece nova tentativa sem expor a mensagem técnica', async () => {
    const { default: ErrorPage } = await import('@/app/error')
    const retry = vi.fn()
    act(() => root.render(createElement(ErrorPage, { error: new Error('segredo técnico'), retry })))
    expect(container.textContent).not.toContain('segredo técnico')
    const button = container.querySelector('button')!
    expect(button).not.toBeNull()
    expect(button.textContent).toMatch(/tentar/i)
    act(() => button.click())
    expect(retry).toHaveBeenCalledTimes(1)
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/')
  })
  it('oferece navegação em português quando uma página não existe', async () => {
    const { default: NotFound } = await import('@/app/not-found')
    act(() => root.render(createElement(NotFound)))
    expect(container.textContent).toMatch(/não encontrada/i)
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/')
  })
})
