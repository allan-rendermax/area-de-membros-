import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MaterialHelp } from '@/components/membros/material-help'

describe('MaterialHelp', () => {
  it('orienta quem não encontra o acesso sem criar um canal fictício', () => {
    const html = renderToStaticMarkup(createElement(MaterialHelp, { href: null, context: 'login' }))
    expect(html).toContain('<details')
    expect(html).toContain('e-mail da compra')
    expect(html).toContain('comprovante')
    expect(html).not.toContain('<a ')
  })

  it('orienta download e aplicativos externos e aceita somente contato HTTP(S)', () => {
    const html = renderToStaticMarkup(createElement(MaterialHelp, { href: 'https://ajuda.example.com', context: 'material' }))
    expect(html).toContain('Downloads')
    expect(html).toContain('aplicativo')
    expect(html).toContain('href="https://ajuda.example.com"')
    const unsafe = renderToStaticMarkup(createElement(MaterialHelp, { href: 'javascript:alert(1)' }))
    expect(unsafe).not.toContain('<a ')
  })
})
