// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { ScrollToMaterials } from '@/components/membros/scroll-to-materials'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); document.body.innerHTML = '' })

it.each(['#materiais', '?previa=1#materiais', ''])('rola somente quando a navegação pede a seção: %s', async (suffix) => {
  window.history.replaceState(null, '', `/arquitetura${suffix}`)
  let finishFrame: FrameRequestCallback | undefined
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { finishFrame = callback; return 1 })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  const container = document.createElement('div')
  document.body.append(container)
  const anchor = document.createElement('section')
  anchor.id = 'materiais'
  anchor.scrollIntoView = vi.fn()
  document.body.append(anchor)
  const root = createRoot(container)
  await act(async () => root.render(createElement(ScrollToMaterials)))
  expect(anchor.scrollIntoView).not.toHaveBeenCalled()
  await act(async () => finishFrame?.(0))
  expect(anchor.scrollIntoView).toHaveBeenCalledTimes(suffix ? 1 : 0)
  if (suffix) expect(anchor.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  await act(async () => root.unmount())
})
