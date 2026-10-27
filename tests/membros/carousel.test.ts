// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Carousel } from '@/components/membros/carousel'
import { MemberTheme } from '@/components/membros/member-theme'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let container: HTMLDivElement
let root: Root
let track: HTMLDivElement
let width: number
let contentWidth: number
let frames: Map<number, FrameRequestCallback>
let frameId: number
let observers: TestResizeObserver[]
class TestResizeObserver {
  elements = new Set<Element>()
  constructor(public callback: ResizeObserverCallback) { observers.push(this) }
  observe(element: Element) { this.elements.add(element) }
  disconnect() { this.elements.clear() }
  unobserve(element: Element) { this.elements.delete(element) }
}
async function render(count = 3) {
  const props = { title: 'Materiais', children: Array.from({ length: count }, (_, i) => createElement('div', { key: i }, `Card ${i}`)) }
  await act(async () => root.render(createElement(MemberTheme, { theme: 'arquitetura' },
    createElement(Carousel, props))))
  track = container.querySelector('.sem-barra')!
  Object.defineProperties(track, {
    clientWidth: { configurable: true, get: () => width },
    scrollWidth: { configurable: true, get: () => contentWidth },
  })
}
async function flush() {
  await act(async () => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
}
function arrows(left: boolean, right: boolean) {
  expect(!!container.querySelector('button[aria-label="Voltar em Materiais"]')).toBe(left)
  expect(!!container.querySelector('button[aria-label="Avançar em Materiais"]')).toBe(right)
}
async function scrollTo(left: number) {
  await act(async () => { track.scrollLeft = left; track.dispatchEvent(new Event('scroll')) })
  await flush()
}
async function resize(element: Element) {
  await act(async () => observers.filter((observer) => observer.elements.has(element)).forEach((observer) => observer.callback([], observer as unknown as ResizeObserver)))
  await flush()
}

beforeEach(() => {
  width = 600; contentWidth = 1800; frames = new Map(); frameId = 0; observers = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Carousel scroll directions', () => {
  it('starts without arrows until measured, then follows start, middle, end and return', async () => {
    await render(); arrows(false, false)
    await flush(); arrows(false, true)
    await scrollTo(600); arrows(true, true)
    await scrollTo(1200); arrows(true, false)
    await scrollTo(0); arrows(false, true)
  })
  it.each([[600, 600, 3], [600, 0, 0], [0, 1800, 3], [600, 601, 3]])('hides both arrows for width %i and content %i', async (viewport, content, count) => {
    width = viewport; contentWidth = content
    await render(count); await flush(); arrows(false, false)
  })
  it('ignores one pixel of fractional edge slack and overscroll', async () => {
    await render(); await flush()
    await scrollTo(1); arrows(false, true)
    await scrollTo(1.1); arrows(true, true)
    await scrollTo(1199); arrows(true, false)
    await scrollTo(1198.9); arrows(true, true)
    await scrollTo(-10); arrows(false, true)
    await scrollTo(1210); arrows(true, false)
  })
  it('remeasures when the track or a card resizes', async () => {
    await render(); await flush(); arrows(false, true)
    width = 1800; await resize(track); arrows(false, false)
    width = 600; await resize(track); arrows(false, true)
    contentWidth = 600; await resize(track.children[0]); arrows(false, false)
    contentWidth = 1800; await resize(track.children[0]); arrows(false, true)
  })
  it('remeasures and observes newly rendered children', async () => {
    contentWidth = 600; await render(1); await flush(); arrows(false, false)
    contentWidth = 1800; await render(4); await flush(); arrows(false, true)
    contentWidth = 600; await resize(track.children[3]); arrows(false, false)
    contentWidth = 0; await render(0); await flush(); arrows(false, false)
  })
  it.each([false, true])('retains 90 percent scroll steps with reduced motion %s', async (reduced) => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: reduced } as MediaQueryList)
    await render(); await flush()
    const scrollBy = vi.fn(); track.scrollBy = scrollBy
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Avançar em Materiais"]')!.click())
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 540, behavior: reduced ? 'auto' : 'smooth' })
    await scrollTo(600)
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Voltar em Materiais"]')!.click())
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -540, behavior: reduced ? 'auto' : 'smooth' })
  })
  it('cancels pending measurements and removes subscriptions on unmount', async () => {
    await render()
    const remove = vi.spyOn(track, 'removeEventListener')
    await act(async () => root.unmount())
    expect(frames.size).toBe(0)
    expect(observers.every((observer) => observer.elements.size === 0)).toBe(true)
    expect(remove.mock.calls.some(([event]) => event === 'scroll')).toBe(true)
    root = createRoot(container)
  })
})
