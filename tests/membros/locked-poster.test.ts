import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LockedPoster } from '@/components/membros/locked-poster'
import type { ShelfProduct } from '@/lib/access/access'

const controls = vi.hoisted(() => ({
  search: 'comprar=atlas&utm_source=email',
  pathname: '/arquitetura',
  routerReplace: vi.fn(),
  setOpen: vi.fn(),
  effect: undefined as undefined | (() => void | (() => void)),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => controls.pathname,
  useRouter: () => ({ replace: controls.routerReplace }),
  useSearchParams: () => new URLSearchParams(controls.search),
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
    useEffect: (effect: () => void | (() => void)) => { controls.effect = effect },
    useRef: <T,>(value: T) => ({ current: value }),
    useState: () => [true, controls.setOpen],
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

function renderPoster() {
  return descendants(LockedPoster({ product, initiallyOpen: true }))
}

function clickClose(elements: TestElement[]) {
  const button = elements.find((element) => element.type === 'button' && element.props.children === 'Fechar')
  expect(button).toBeDefined()
  ;(button?.props.onClick as () => void)()
}

describe('fechamento de LockedPoster', () => {
  const replaceState = vi.fn()
  let keydown: ((event: { key: string }) => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    controls.search = 'comprar=atlas&utm_source=email'
    controls.pathname = '/arquitetura'
    controls.effect = undefined
    keydown = undefined
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        history: { replaceState },
        location: { hash: '#detalhes' },
        addEventListener: vi.fn((type: string, listener: (event: { key: string }) => void) => {
          if (type === 'keydown') keydown = listener
        }),
        removeEventListener: vi.fn(),
      },
    })
  })

  it('remove somente comprar com replaceState ao clicar em Fechar', () => {
    clickClose(renderPoster())

    expect(controls.setOpen).toHaveBeenCalledWith(false)
    expect(replaceState).toHaveBeenCalledWith(null, '', '/arquitetura?utm_source=email#detalhes')
    expect(controls.routerReplace).not.toHaveBeenCalled()
  })

  it('não altera a URL quando comprar não está presente', () => {
    controls.search = 'utm_source=email'

    clickClose(renderPoster())

    expect(controls.setOpen).toHaveBeenCalledWith(false)
    expect(replaceState).not.toHaveBeenCalled()
    expect(controls.routerReplace).not.toHaveBeenCalled()
  })

  it('usa o mesmo fechamento no Escape e no clique fora do painel', () => {
    const elements = renderPoster()
    controls.effect?.()
    keydown?.({ key: 'Escape' })
    const backdrop = elements.find((element) => element.props.role === 'dialog')
    expect(backdrop).toBeDefined()
    ;(backdrop?.props.onClick as () => void)()

    expect(replaceState).toHaveBeenCalledTimes(2)
    expect(controls.routerReplace).not.toHaveBeenCalled()
  })
})
