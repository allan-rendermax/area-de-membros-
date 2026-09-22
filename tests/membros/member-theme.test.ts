// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it } from 'vitest'
import { MemberTheme } from '@/components/membros/member-theme'
import { Modal } from '@/components/membros/modal'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let cleanup: (() => void) | undefined
afterEach(() => cleanup?.())

it('leva o tema até o portal e o remove ao navegar para outra loja, sem alterar body', () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  cleanup = () => { act(() => root.unmount()); container.remove() }
  const render = (theme: 'arquitetura' | undefined) => act(() => root.render(
    createElement(MemberTheme, { theme },
      createElement(Modal, { open: true, onClose: () => {}, labelledBy: 'test-title' },
        createElement('h2', { id: 'test-title' }, 'Oferta'),
        createElement('button', null, 'Fechar'),
      ),
    ),
  ))
  render('arquitetura')
  expect(container.querySelector('[data-member-theme="arquitetura"]')).not.toBeNull()
  const panel = document.querySelector('[role="dialog"]')!
  expect(panel.parentElement?.dataset.memberTheme).toBe('arquitetura')
  expect(document.body.dataset.memberTheme).toBeUndefined()
  expect(panel.closest('body')).toBe(document.body)
  render(undefined)
  expect(document.querySelector('[data-member-theme="arquitetura"]')).toBeNull()
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
})
