// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LessonToolbar, type LessonToolbarProps } from '@/components/membros/lesson-toolbar'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const base: LessonToolbarProps = {
  storeId: 'store-a', customerId: 'customer-a', productTitle: 'Curso de desenho',
  moduleTitle: 'Fundamentos', itemId: 'item-a', itemTitle: 'Traços',
  description: 'Aprenda a desenhar com confiança.',
  previous: { href: '/loja/aula/anterior', title: 'Preparação' },
  next: { href: '/loja/aula/proxima', title: 'Formas' },
}
let container: HTMLDivElement
let root: Root

async function render(props: LessonToolbarProps = base) {
  await act(async () => root.render(createElement(LessonToolbar, props)))
}
function button(label: string) {
  const found = [...container.querySelectorAll('button')].find((node) => node.textContent?.trim() === label)
  if (!found) throw new Error(`Missing button: ${label}`)
  return found
}
async function click(element: HTMLElement) { await act(async () => element.click()) }

describe('LessonToolbar', () => {
  beforeEach(async () => {
    localStorage.clear()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await render()
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })

  it('links to the supplied previous and next lessons', () => {
    expect(container.querySelector('a[href="/loja/aula/anterior"]')?.textContent).toContain('Aula anterior')
    expect(container.querySelector('a[href="/loja/aula/proxima"]')?.textContent).toContain('Próxima aula')
  })

  it('disables navigation at the first and last lessons', async () => {
    await render({ ...base, previous: null, next: null })
    expect((button('Aula anterior') as HTMLButtonElement).disabled).toBe(true)
    expect((button('Próxima aula') as HTMLButtonElement).disabled).toBe(true)
    expect(container.querySelector('a[href=""]')).toBeNull()
  })

  it('shows lesson context and closes Sobre with Escape, returning focus', async () => {
    const trigger = button('Sobre')
    await click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const panel = document.getElementById(trigger.getAttribute('aria-controls')!)
    expect(panel?.textContent).toContain('Curso de desenho')
    expect(panel?.textContent).toContain('Fundamentos')
    expect(panel?.textContent).toContain('Traços')
    expect(panel?.textContent).toContain('Aprenda a desenhar com confiança.')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('closes Sobre from its close button and outside click', async () => {
    const trigger = button('Sobre')
    await click(trigger)
    await click(button('Fechar informações'))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
    await click(trigger)
    await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('saves reversible completion only in this browser and restores on remount', async () => {
    expect(container.textContent).toContain('Salvo neste navegador')
    await click(button('Concluir'))
    expect(button('Concluído').getAttribute('aria-pressed')).toBe('true')
    await act(async () => root.unmount())
    root = createRoot(container)
    await render()
    expect(button('Concluído').getAttribute('aria-pressed')).toBe('true')
    await click(button('Concluído'))
    expect(button('Concluir').getAttribute('aria-pressed')).toBe('false')
  })

  it('isolates completion by store, customer and lesson when props change', async () => {
    await click(button('Concluir'))
    await render({ ...base, itemId: 'item-b' })
    expect(button('Concluir').getAttribute('aria-pressed')).toBe('false')
    await render({ ...base, customerId: 'customer-b' })
    expect(button('Concluir').getAttribute('aria-pressed')).toBe('false')
    await render({ ...base, storeId: 'store-b' })
    expect(button('Concluir').getAttribute('aria-pressed')).toBe('false')
    await render()
    expect(button('Concluído').getAttribute('aria-pressed')).toBe('true')
  })

  it('does not claim completion was saved when local storage rejects writes', async () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('storage denied') })
    await click(button('Concluir'))
    expect(button('Concluir').getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/não foi possível salvar/i)
    expect(container.textContent).not.toContain('Salvo neste navegador')
  })
})
