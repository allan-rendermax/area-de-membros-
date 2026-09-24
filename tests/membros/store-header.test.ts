import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StoreHeader } from '@/components/membros/store-header'

describe('StoreHeader', () => {
  it('oferece materiais no celular e identifica a navegação atual', () => {
    const html = renderToStaticMarkup(createElement(StoreHeader, {
      store: { slug: 'arquitetura', name: 'Arquitetura', logoUrl: null }, email: 'aluna@example.com', active: 'materials',
    }))
    expect(html).toContain('Meus materiais')
    expect(html).toContain('aria-current="location"')
    expect(html).not.toContain('aria-current="page"')
    expect(html).toContain('sm:hidden')
    expect(html).toMatch(/class="[^"]*sm:hidden[^"]*"[^>]*>Meus materiais<\/a>/)
    expect(html).toContain('min-h-11')
  })
})
