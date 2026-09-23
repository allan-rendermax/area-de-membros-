// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminLoginForm } from '@/app/admin/entrar/form'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const actions = vi.hoisted(() => ({
  enviarCodigo: vi.fn(),
  verificarCodigo: vi.fn(),
}))

vi.mock('@/app/admin/entrar/actions', () => actions)

let container: HTMLDivElement
let root: Root

async function submit(buttonText: string) {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(buttonText))
  if (!button) throw new Error(`Missing button: ${buttonText}`)
  await act(async () => {
    (button as HTMLButtonElement).click()
  })
}

describe('AdminLoginForm interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    actions.enviarCodigo.mockImplementation(async (_state, data: FormData) => ({
      step: 'code', email: String(data.get('email')), error: null,
    }))
    actions.verificarCodigo.mockImplementation(async (_state, data: FormData) => ({
      step: 'code', email: String(data.get('email')), error: 'Código inválido ou expirado.',
    }))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('preserves the explicit browser choice after invalid code and resend', async () => {
    await act(async () => root.render(createElement(AdminLoginForm)))
    const email = container.querySelector<HTMLInputElement>('input[name="email"]')!
    expect(email.labels?.[0]?.textContent).toContain('E-mail')
    email.value = 'admin@example.test'
    await submit('Enviar código')

    const remember = container.querySelector<HTMLInputElement>('input[name="rememberBrowser"]')!
    expect(remember.checked).toBe(false)
    await act(async () => remember.click())
    expect(remember.checked).toBe(true)
    await act(async () => root.render(createElement(AdminLoginForm)))
    expect(container.querySelector<HTMLInputElement>('input[name="rememberBrowser"]')?.checked).toBe(true)

    const token = container.querySelector<HTMLInputElement>('input[name="token"]')!
    expect(token.labels?.[0]?.textContent).toContain('Código')
    token.value = '000000'
    await submit('Entrar')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('inválido')
    expect(container.querySelector<HTMLInputElement>('input[name="rememberBrowser"]')?.checked).toBe(true)

    await submit('Reenviar código')
    expect(container.querySelector<HTMLInputElement>('input[name="rememberBrowser"]')?.checked).toBe(true)
  })
})
