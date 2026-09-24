import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useActionState: () => [{ error: 'E-mail não encontrado', email: 'aluna@example.com', supportHref: null }, () => {}, false],
  }
})

import { EntrarForm } from '@/app/[loja]/entrar/form'

describe('EntrarForm', () => {
  it('associa o erro ao campo e mantém o e-mail após falha', () => {
    const html = renderToStaticMarkup(createElement(EntrarForm, {
      action: async () => ({ error: null, email: '', supportHref: null }),
      initialEmail: '', stamp: 'stamp', turnstileSiteKey: null,
    }))
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="email-error"')
    expect(html).toContain('id="email-error"')
    expect(html).toContain('value="aluna@example.com"')
  })
})
