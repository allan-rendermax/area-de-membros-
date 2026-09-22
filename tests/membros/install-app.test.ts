// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { InstallAppButton } from '@/components/membros/install-app-button'

let root: Root
let header: HTMLElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
  header = document.createElement('header')
  header.style.backdropFilter = 'blur(12px)'
  document.body.append(header)
  root = createRoot(header)
})
afterEach(() => {
  act(() => root.unmount())
  header.remove()
  vi.restoreAllMocks()
})
it('abre ajuda iPhone fora do header, fecha com Escape e restaura o acionador', () => {
  act(() => root.render(createElement(InstallAppButton)))
  const trigger = header.querySelector('button')!
  expect(trigger).not.toBeNull()
  act(() => trigger.click())
  const dialog = document.querySelector('[role="dialog"]')!
  expect(header.contains(dialog)).toBe(false)
  expect(document.activeElement?.textContent).toBe('Entendi')
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})
