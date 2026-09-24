import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MaterialHelp } from '@/components/membros/material-help'

describe('MaterialHelp', () => {
  it('orienta quem não encontra o acesso e sempre mostra o e-mail de suporte', () => {
    const html = renderToStaticMarkup(createElement(MaterialHelp, { href: null, context: 'login' }))
    expect(html).toContain('<details')
    expect(html).toContain('e-mail da compra')
    expect(html).toContain('comprovante')
    expect(html).toContain('href="mailto:grupoelevamax@gmail.com"')
    expect(html).toContain('grupoelevamax@gmail.com')
    expect(html).not.toContain('href="https://wa.me/')
  })

  it('orienta download e aplicativos externos e mantém o contato HTTP(S)', () => {
    const html = renderToStaticMarkup(createElement(MaterialHelp, { href: 'https://ajuda.example.com', context: 'material' }))
    expect(html).toContain('Downloads')
    expect(html).toContain('aplicativo')
    expect(html).toContain('href="https://ajuda.example.com"')
    expect(html).toContain('Falar com o suporte')
    expect(html).toContain('href="mailto:grupoelevamax@gmail.com"')
  })

  it.each([
    'https://wa.me/5511999998888?text=Oi',
    'https://api.whatsapp.com/send?phone=5511999998888',
    'https://www.whatsapp.com/channel/example',
  ])('identifica WhatsApp em %s e mantém o e-mail', (href) => {
    const html = renderToStaticMarkup(createElement(MaterialHelp, { href }))
    expect(html).toContain(`href="${href.replaceAll('&', '&amp;')}"`)
    expect(html).toContain('Falar pelo WhatsApp')
    expect(html).toContain('href="mailto:grupoelevamax@gmail.com"')
  })

  it('rejeita URL insegura sem remover o e-mail', () => {
    const unsafe = renderToStaticMarkup(createElement(MaterialHelp, { href: 'javascript:alert(1)' }))
    expect(unsafe).not.toContain('href="javascript:')
    expect(unsafe).toContain('href="mailto:grupoelevamax@gmail.com"')
  })
})
