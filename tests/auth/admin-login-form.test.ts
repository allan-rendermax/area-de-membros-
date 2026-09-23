import { useActionState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminLoginForm } from '@/app/admin/entrar/form'

const actions = vi.hoisted(() => ({
  enviarCodigo: vi.fn(),
  verificarCodigo: vi.fn(),
}))

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useActionState: vi.fn(),
  useState: vi.fn(() => [false, vi.fn()]),
  useRef: vi.fn(() => ({ current: null })),
  useEffect: vi.fn(),
}))
vi.mock('@/app/admin/entrar/actions', () => actions)

type ElementNode = {
  type: unknown
  props: Record<string, unknown> & { children?: unknown }
}

function elements(node: unknown): ElementNode[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as ElementNode
  return [element, ...elements(element.props.children)]
}

function text(node: unknown): string {
  if (Array.isArray(node)) return node.map(text).join('')
  if (typeof node === 'string') return node
  if (!node || typeof node !== 'object' || !('props' in node)) return ''
  return text((node as ElementNode).props.children)
}

describe('AdminLoginForm — reenvio de código', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('oferece reenvio para o mesmo e-mail no passo de código', () => {
    const resend = vi.fn()
    const verify = vi.fn()
    vi.mocked(useActionState)
      .mockReturnValueOnce([
        { step: 'code', email: 'admin@example.com', error: null },
        resend,
        false,
      ] as never)
      .mockReturnValueOnce([
        { step: 'email', email: '', error: null },
        verify,
        false,
      ] as never)

    const rendered = elements(AdminLoginForm())
    const resendButton = rendered.find((element) => element.type === 'button' && text(element).includes('Reenviar código'))
    const email = rendered.find((element) => element.type === 'input' && element.props.name === 'email')

    expect(resendButton?.props.formAction).toBe(resend)
    expect(resendButton?.props.formNoValidate).toBe(true)
    expect(email?.props.value).toBe('admin@example.com')
    const remember = rendered.find((element) => element.type === 'input' && element.props.name === 'rememberBrowser')
    expect(remember?.props.type).toBe('checkbox')
    expect(remember?.props.defaultChecked).not.toBe(true)
    expect(rendered.filter((element) => element.type === 'label').map(text).join(' ')).toContain('7 dias')
  })
})
