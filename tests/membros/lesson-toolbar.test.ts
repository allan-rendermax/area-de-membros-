// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LessonToolbar, type LessonToolbarProps } from '@/components/membros/lesson-toolbar'

import { saveCompletion } from '@/app/[loja]/progresso/actions'
vi.mock('@/app/[loja]/progresso/actions', () => ({ saveCompletion: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const base: LessonToolbarProps = {
  storeSlug: 'loja-a', initialCompleted: false, productTitle: 'Curso de desenho',
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
    vi.mocked(saveCompletion).mockReset()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await render()
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })

  it('links to the supplied previous and next lessons', () => {
    expect(container.querySelector('a[href="/loja/aula/anterior"]')?.textContent).toContain('Conteúdo anterior')
    expect(container.querySelector('a[href="/loja/aula/proxima"]')?.textContent).toContain('Próximo conteúdo')
  })

  it('disables navigation at the first and last lessons', async () => {
    await render({ ...base, previous: null, next: null })
    expect((button('Conteúdo anterior') as HTMLButtonElement).disabled).toBe(true)
    expect((button('Próximo conteúdo') as HTMLButtonElement).disabled).toBe(true)
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

  it('preserva conclusão anterior quando o servidor recusa a escrita', async () => {
    await render({ ...base, initialCompleted: true })
    vi.mocked(saveCompletion).mockResolvedValue({ ok: false, error: 'Não foi possível salvar o progresso. Tente novamente.' })
    await click(button('Concluído'))
    expect(button('Concluído').getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível salvar')
  })

  it('aguarda o servidor, impede repetição pendente e permite desfazer', async () => {
    let resolve!: (value: { ok: true; completed: boolean }) => void
    vi.mocked(saveCompletion).mockReturnValueOnce(new Promise((done) => { resolve = done }))
    await click(button('Concluir'))
    expect((button('Salvando…') as HTMLButtonElement).disabled).toBe(true)
    await click(button('Salvando…'))
    expect(saveCompletion).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ ok: true, completed: true }))
    expect(button('Concluído').getAttribute('aria-pressed')).toBe('true')
    vi.mocked(saveCompletion).mockResolvedValueOnce({ ok: true, completed: false })
    await click(button('Concluído'))
    expect(button('Concluir').getAttribute('aria-pressed')).toBe('false')
  })
})
