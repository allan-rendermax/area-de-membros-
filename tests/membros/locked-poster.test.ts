import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LockedPoster } from '@/components/membros/locked-poster'
import type { ShelfProduct } from '@/lib/access/access'

type EffectSlot = {
  cleanup?: () => void
  deps?: readonly unknown[]
  effect?: () => void | (() => void)
}

type CallbackSlot = {
  callback: (...args: never[]) => unknown
  deps: readonly unknown[]
}

const controls = vi.hoisted(() => ({
  search: 'comprar=atlas&utm_source=email',
  pathname: '/arquitetura',
  stateCursor: 0,
  stateValues: [] as unknown[],
  refCursor: 0,
  refValues: [] as Array<{ current: unknown }>,
  callbackCursor: 0,
  callbackValues: [] as CallbackSlot[],
  effectCursor: 0,
  effectValues: [] as EffectSlot[],
  pendingEffects: [] as number[],
  dirty: false,
}))

function depsChanged(previous: readonly unknown[] | undefined, next: readonly unknown[] | undefined) {
  return !previous || !next || previous.length !== next.length || previous.some((value, index) => !Object.is(value, next[index]))
}

vi.mock('next/navigation', () => ({
  usePathname: () => controls.pathname,
  useSearchParams: () => new URLSearchParams(controls.search),
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: <S,>(initialState: S | (() => S)) => {
      const index = controls.stateCursor++
      if (!(index in controls.stateValues)) {
        controls.stateValues[index] = typeof initialState === 'function'
          ? (initialState as () => S)()
          : initialState
      }
      const setState = (nextState: S | ((previous: S) => S)) => {
        const previous = controls.stateValues[index] as S
        const next = typeof nextState === 'function'
          ? (nextState as (value: S) => S)(previous)
          : nextState
        if (!Object.is(previous, next)) {
          controls.stateValues[index] = next
          controls.dirty = true
        }
      }
      return [controls.stateValues[index] as S, setState] as const
    },
    useRef: <T,>(initialValue: T) => {
      const index = controls.refCursor++
      controls.refValues[index] ??= { current: initialValue }
      return controls.refValues[index] as { current: T }
    },
    useCallback: <T extends (...args: never[]) => unknown>(callback: T, deps: readonly unknown[]) => {
      const index = controls.callbackCursor++
      const previous = controls.callbackValues[index]
      if (!previous || depsChanged(previous.deps, deps)) controls.callbackValues[index] = { callback, deps }
      return controls.callbackValues[index].callback as T
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const index = controls.effectCursor++
      const previous = controls.effectValues[index]
      if (!previous || depsChanged(previous.deps, deps)) {
        controls.effectValues[index] = { ...previous, deps, effect }
        controls.pendingEffects.push(index)
      }
    },
  }
})

const product: ShelfProduct = {
  id: 'product-a',
  slug: 'atlas',
  title: 'Atlas',
  track: 'Projetos',
  sortOrder: 1,
  description: 'Descrição',
  coverUrl: '/covers/atlas.jpg',
  bannerUrl: '/covers/atlas-banner.jpg',
  unlocked: false,
  checkoutUrl: 'https://checkout.example.com/atlas',
}

type TestElement = ReactElement<Record<string, unknown>, string | React.JSXElementConstructor<unknown>>

function descendants(node: ReactNode): TestElement[] {
  if (!isValidElement<Record<string, unknown>>(node)) return []
  const element = node as TestElement
  return [element, ...Children.toArray(element.props.children as ReactNode).flatMap(descendants)]
}

function beginRender(initiallyOpen: boolean) {
  controls.stateCursor = 0
  controls.refCursor = 0
  controls.callbackCursor = 0
  controls.effectCursor = 0
  controls.pendingEffects = []
  controls.dirty = false
  return descendants(LockedPoster({ product, initiallyOpen }))
}

function renderPoster(initiallyOpen: boolean) {
  let elements: TestElement[] = []
  do {
    elements = beginRender(initiallyOpen)
    const pendingEffects = [...controls.pendingEffects]
    for (const index of pendingEffects) {
      const slot = controls.effectValues[index]
      slot.cleanup?.()
      const cleanup = slot.effect?.()
      slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined
    }
  } while (controls.dirty)
  return elements
}

function dialog(elements: TestElement[]) {
  return elements.find((element) => element.props.role === 'dialog')
}

function clickClose(elements: TestElement[]) {
  const button = elements.find((element) => element.type === 'button' && element.props.children === 'Fechar')
  expect(button).toBeDefined()
  ;(button?.props.onClick as () => void)()
}

function changeSearch(search: string) {
  controls.search = search
}

describe('LockedPoster', () => {
  const replaceState = vi.fn((_state: unknown, _unused: string, url: string) => {
    const parsed = new URL(url, 'https://membros.example.com')
    controls.search = parsed.search.slice(1)
  })
  let keydown: ((event: { key: string }) => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    controls.search = 'comprar=atlas&utm_source=email'
    controls.pathname = '/arquitetura'
    controls.stateCursor = 0
    controls.stateValues = []
    controls.refCursor = 0
    controls.refValues = []
    controls.callbackCursor = 0
    controls.callbackValues = []
    controls.effectCursor = 0
    controls.effectValues = []
    controls.pendingEffects = []
    controls.dirty = false
    keydown = undefined
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        history: { replaceState },
        location: { hash: '#detalhes' },
        addEventListener: vi.fn((type: string, listener: (event: { key: string }) => void) => {
          if (type === 'keydown') keydown = listener
        }),
        removeEventListener: vi.fn((type: string, listener: (event: { key: string }) => void) => {
          if (type === 'keydown' && keydown === listener) keydown = undefined
        }),
      },
    })
  })

  it('reabre o mesmo produto quando comprar volta à URL após o fechamento', () => {
    let elements = renderPoster(true)
    expect(dialog(elements)).toBeDefined()

    clickClose(elements)
    elements = renderPoster(true)
    expect(dialog(elements)).toBeUndefined()
    expect(replaceState).toHaveBeenCalledWith(null, '', '/arquitetura?utm_source=email#detalhes')

    changeSearch('comprar=atlas')
    elements = renderPoster(true)
    expect(dialog(elements)).toBeDefined()
  })

  it('fecha o produto quando comprar muda e acompanha voltar e avançar', () => {
    let elements = renderPoster(true)
    expect(dialog(elements)).toBeDefined()

    changeSearch('comprar=outro')
    elements = renderPoster(true)
    expect(dialog(elements)).toBeUndefined()

    changeSearch('comprar=atlas')
    elements = renderPoster(true)
    expect(dialog(elements)).toBeDefined()

    changeSearch('comprar=outro')
    elements = renderPoster(true)
    expect(dialog(elements)).toBeUndefined()
  })

  it('abre pelo poster sem adicionar comprar à URL', () => {
    changeSearch('utm_source=email')
    let elements = renderPoster(false)
    const poster = elements.find((element) => element.type === 'button' && element.props['aria-label'] === 'Atlas — bloqueado, ver detalhes')

    expect(poster).toBeDefined()
    ;(poster?.props.onClick as () => void)()
    elements = renderPoster(false)

    expect(dialog(elements)).toBeDefined()
    expect(replaceState).not.toHaveBeenCalled()
  })

  it('não altera a URL ao fechar quando comprar não está presente', () => {
    changeSearch('utm_source=email')
    let elements = renderPoster(false)
    const poster = elements.find((element) => element.type === 'button' && element.props['aria-label'] === 'Atlas — bloqueado, ver detalhes')
    ;(poster?.props.onClick as () => void)()
    elements = renderPoster(false)

    clickClose(elements)

    expect(replaceState).not.toHaveBeenCalled()
  })

  it('usa o mesmo fechamento no Escape e no clique fora do painel', () => {
    let elements = renderPoster(true)
    keydown?.({ key: 'Escape' })
    elements = renderPoster(true)
    expect(dialog(elements)).toBeUndefined()

    changeSearch('comprar=atlas')
    elements = renderPoster(true)
    expect(dialog(elements)).toBeDefined()
    ;(dialog(elements)?.props.onClick as () => void)()
    elements = renderPoster(true)

    expect(dialog(elements)).toBeUndefined()
    expect(replaceState).toHaveBeenCalledTimes(2)
  })
})
