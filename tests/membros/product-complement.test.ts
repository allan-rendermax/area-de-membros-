import { renderToStaticMarkup } from 'react-dom/server'
import { createElement, Fragment } from 'react'
import { Window } from 'happy-dom'
import { describe, expect, it } from 'vitest'
import { ProductComplementCard, ProductComplementOffer, ComplementPoster, ComplementPurchasePrompt } from '@/components/membros/product-complement'
import { LessonSidebar } from '@/components/membros/lesson-sidebar'
import type { ProductComplement } from '@/lib/access/product-complement'
import type { Product } from '@/lib/domain/types'

const product = { id: 'protocol', title: 'Protocolo Anti-Retrabalho', description: 'Evite retrabalho', slug: 'protocolo' } as Product
function doc(html: string) { const window = new Window(); window.document.body.innerHTML = html; return window.document }

describe('product complement surfaces', () => {
  it('links owners internally without sales copy', () => {
    const complement: ProductComplement = { product, owned: true, href: '/arquitetura/produto/protocolo', external: false }
    const document = doc(renderToStaticMarkup(createElement(Fragment, null, createElement(ProductComplementCard, { complement }), createElement(ProductComplementOffer, { complement }))))
    expect(document.querySelectorAll('a[href="/arquitetura/produto/protocolo"]')).toHaveLength(2)
    expect(document.body.textContent).toContain('Seu produto está liberado')
    expect(document.body.textContent).not.toContain('Evite retrabalho')
    expect(document.body.textContent).not.toContain('Comprar')
  })
  it('links nonbuyers to validated checkout in new tab and handles unavailable purchase', () => {
    const complement: ProductComplement = { product, owned: false, href: 'https://example.test/buy', external: true }
    const document = doc(renderToStaticMarkup(createElement(ProductComplementCard, { complement })))
    expect(document.querySelector('a')?.getAttribute('target')).toBe('_blank')
    expect(document.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(document.body.textContent).toContain('Comprar Protocolo Anti-Retrabalho')
    const unavailable = doc(renderToStaticMarkup(createElement(ProductComplementCard, { complement: { ...complement, href: null } })))
    expect(unavailable.querySelector('a')).toBeNull()
    expect(unavailable.body.textContent).toContain('Compra indisponível')
  })
  it('keeps complement outside collapsed contents even with no usable items', () => {
    const complement: ProductComplement = { product, owned: true, href: '/arquitetura/produto/protocolo', external: false }
    const document = doc(renderToStaticMarkup(createElement(LessonSidebar, { modules: [], storeSlug: 'arquitetura', complement: createElement(ProductComplementCard, { complement }) })))
    expect(document.querySelector('aside[aria-label="Conteúdos do produto"]')).not.toBeNull()
    expect(document.querySelector('details.lesson-contents')?.contains(document.querySelector('section[aria-label="Produto complementar"]')!)).toBe(false)
  })
  it('shows a deep-link purchase action while the cover still opens checkout directly', () => {
    const cover = { id: 'protocol', slug: 'protocol', title: 'Protocolo Anti-Retrabalho', coverUrl: null, checkoutUrl: 'https://example.test/regular', studentCheckoutUrl: 'https://example.test/student', unlocked: false } as import('@/lib/access/access').ShelfProduct
    const document = doc(renderToStaticMarkup(createElement(Fragment, null, createElement(ComplementPurchasePrompt, { product: cover }), createElement(ComplementPoster, { product: cover }))))
    const prompt = document.querySelector('section[aria-label="Compra solicitada"]')
    expect(prompt?.textContent).toContain('Protocolo Anti-Retrabalho')
    expect(prompt?.querySelector('a')?.getAttribute('href')).toBe('https://example.test/student')
    expect(prompt?.querySelector('a')?.getAttribute('target')).toBe('_blank')
    expect(document.querySelector('a[aria-label="Comprar Protocolo Anti-Retrabalho"]')?.getAttribute('href')).toBe('https://example.test/student')
    expect(document.querySelector('dialog')).toBeNull()
  })
})
