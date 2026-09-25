// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LockedPoster } from '@/components/membros/locked-poster'
import type { ShelfProduct } from '@/lib/access/access'

const controls = vi.hoisted(() => ({ search: 'comprar=atlas&utm_source=email' }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/arquitetura',
  useSearchParams: () => new URLSearchParams(controls.search),
}))

const product: ShelfProduct = {
  id: 'product-a', slug: 'atlas', title: 'Atlas', track: 'Projetos', sortOrder: 1,
  description: 'Descrição', coverUrl: '/covers/atlas.jpg', bannerUrl: '/covers/atlas-banner.jpg',
  unlocked: false, checkoutUrl: 'https://checkout.example.com/atlas',
}
let root: Root
let container: HTMLDivElement
let replaceState: ReturnType<typeof vi.spyOn>
function render(initiallyOpen = true, offer: ShelfProduct = product) {
  act(() => root.render(createElement(LockedPoster, { product: offer, initiallyOpen })))
}
function dialog() { return document.querySelector<HTMLElement>('[role="dialog"]') }
function button(text: string) {
  return [...document.querySelectorAll('button')].find((element) => element.textContent === text)!
}
function click(element: HTMLElement) { act(() => element.click()) }
function close() { click(button('Fechar')) }

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  controls.search = 'comprar=atlas&utm_source=email'
  window.history.replaceState(null, '', '/arquitetura?comprar=atlas&utm_source=email#detalhes')
  replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation((_state, _unused, url) => {
    controls.search = new URL(String(url), 'https://membros.example.com').search.slice(1)
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

describe('LockedPoster', () => {
  it('mostra título, texto e imagem opcionais personalizados com CTA direto', () => {
    render(true, { ...product, purchaseTitle: 'Libere seus projetos', purchaseDescription: 'Primeiro parágrafo.\n\nSegundo parágrafo.', purchaseImageUrl: 'https://example.com/mockup.png', purchaseButtonText: 'Quero meu pack' })
    expect(dialog()?.querySelector('h2')?.textContent).toBe('Libere seus projetos')
    expect(dialog()?.textContent).toContain('Segundo parágrafo.')
    expect(dialog()?.querySelector('img')?.getAttribute('src')).toBe('https://example.com/mockup.png')
    expect(dialog()?.querySelector('a')?.textContent).toContain('Quero meu pack')
    expect(dialog()?.querySelector('a')?.getAttribute('href')).toBe(product.checkoutUrl)
  })
  it('não reserva espaço de imagem quando não foi configurada', () => {
    render()
    expect(dialog()?.querySelector('img')).toBeNull()
  })
  it('reabre o mesmo produto quando comprar volta à URL após o fechamento', () => {
    render()
    expect(dialog()).not.toBeNull()
    close()
    render()
    expect(dialog()).toBeNull()
    expect(replaceState).toHaveBeenCalledWith(null, '', '/arquitetura?utm_source=email#detalhes')
    controls.search = 'comprar=atlas'
    render()
    expect(dialog()).not.toBeNull()
  })
  it('fecha o produto quando comprar muda e acompanha voltar e avançar', () => {
    render()
    for (const [search, open] of [['comprar=outro', false], ['comprar=atlas', true], ['comprar=outro', false]] as const) {
      controls.search = search
      render()
      expect(Boolean(dialog())).toBe(open)
    }
  })
  it('abre pelo poster sem adicionar comprar à URL e fecha sem alterar a URL', () => {
    controls.search = 'utm_source=email'
    render(false)
    click(container.querySelector('button')!)
    expect(dialog()).not.toBeNull()
    close()
    expect(replaceState).not.toHaveBeenCalled()
  })
  it('usa o mesmo fechamento no Escape e no clique fora do painel', () => {
    render()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    render()
    expect(dialog()).toBeNull()
    controls.search = 'comprar=atlas'
    render()
    click(dialog()!.classList.contains('fixed') ? dialog()! : dialog()!.parentElement!)
    expect(dialog()).toBeNull()
    expect(replaceState).toHaveBeenCalledTimes(2)
  })
  it('restaura o acionador quando clique nativo nao move o foco', () => {
    controls.search = ''
    render(false)
    const trigger = container.querySelector('button')!
    click(trigger)
    close()
    expect(document.activeElement).toBe(trigger)
  })
  it('abre em portal, contém Tab e devolve o foco ao poster real ao fechar', () => {
    controls.search = ''
    render(false)
    const trigger = container.querySelector('button')!
    trigger.focus()
    click(trigger)
    const panel = dialog()!
    expect(container.contains(panel)).toBe(false)
    const first = panel.querySelector('a')!
    const last = button('Fechar')
    expect(document.activeElement).toBe(first)
    last.focus()
    act(() => last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })))
    expect(document.activeElement).toBe(first)
    act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })))
    expect(document.activeElement).toBe(last)
    close()
    expect(document.activeElement).toBe(trigger)
  })
  it('devolve foco ao card após abertura direta por comprar e fechamento com Escape ou Fechar', () => {
    render(true)
    const trigger = container.querySelector('button')!
    expect(dialog()).not.toBeNull()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.activeElement).toBe(trigger)
    controls.search = 'comprar=atlas'
    render(true)
    expect(dialog()).not.toBeNull()
    close()
    expect(document.activeElement).toBe(trigger)
  })
  it('devolve foco ao card quando comprar abre via busca com outro elemento focado', () => {
    controls.search = ''
    render(false)
    const trigger = container.querySelector('button')!
    const other = document.createElement('button')
    document.body.append(other)
    try {
      other.focus()
      controls.search = 'comprar=atlas'
      render(false)
      expect(dialog()).not.toBeNull()
      close()
      expect(document.activeElement).toBe(trigger)
    } finally { other.remove() }
  })

  it('leva direto ao checkout promocional com o texto configurado, sem etapa extra', () => {
    controls.search = ''
    const promotional = 'https://checkout.example.test/item?coupon=ALUNO10&utm_source=members#payment'
    render(false, { ...product, studentCheckoutUrl: promotional, purchaseButtonText: 'Quero meu desconto' })
    const trigger = container.querySelector('button')!
    click(trigger)
    const checkout = dialog()!.querySelector<HTMLAnchorElement>('a[href]')!
    expect(checkout.textContent).toContain('Quero meu desconto')
    expect(checkout.getAttribute('href')).toBe(promotional)
    expect(checkout.target).toBe('_blank')
    expect(checkout.rel).toBe('noopener noreferrer')
    expect(document.activeElement).toBe(checkout)
    expect(dialog()?.textContent).not.toContain('Resgatar meu cupom')
    close()
    expect(document.activeElement).toBe(trigger)
  })

  it('não promete desconto sem checkout promocional válido e conserva o fallback seguro', () => {
    controls.search = ''
    render(false, { ...product, studentCheckoutUrl: 'javascript:alert(1)' })
    click(container.querySelector('button')!)
    expect(dialog()?.textContent).not.toContain('10%')
    expect(dialog()?.querySelector('a')?.getAttribute('href')).toBe(product.checkoutUrl)
    close()
    render(false, { ...product, checkoutUrl: 'javascript:alert(1)', studentCheckoutUrl: null })
    click(container.querySelector('button')!)
    expect(dialog()?.querySelector('a')).toBeNull()
    expect(dialog()?.textContent).toContain('Este material ainda não está disponível para compra.')
  })

  it('acompanha comprar ao trocar de produto com checkout promocional', () => {
    const offer = { ...product, studentCheckoutUrl: 'https://checkout.example.test/coupon' }
    render(true, offer)
    controls.search = 'comprar=outro'
    render(true, offer)
    expect(dialog()).toBeNull()
    controls.search = 'comprar=atlas'
    render(true, offer)
    expect(dialog()?.querySelector('a')?.getAttribute('href')).toBe(offer.studentCheckoutUrl)
  })
})
