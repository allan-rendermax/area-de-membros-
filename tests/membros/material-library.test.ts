// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { MaterialLibrary } from '@/components/membros/material-library'
import type { ShelfProduct } from '@/lib/access/access'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const product: ShelfProduct = { id: 'a', slug: 'a', title: 'Construção sustentável', track: 'Técnicas', sortOrder: 0, description: '', coverUrl: null, bannerUrl: null, checkoutUrl: null, unlocked: true }
it('busca sem diferenciar acentos/caixa, mostra vazio e limpa filtro', async () => {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(createElement(MaterialLibrary, { products: [product, { ...product, id: 'b', slug: 'b', title: 'Outro material', track: 'Obras' }], storeSlug: 'loja' })))
  const input = container.querySelector('input')!
  async function search(value: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) }) }
  await search('CONSTRUCAO')
  expect(container.querySelectorAll('a')).toHaveLength(1)
  await search('TECNICAS')
  expect(container.querySelectorAll('a')).toHaveLength(1)
  await search('ausente')
  expect(container.textContent).toContain('Nenhum material encontrado')
  await act(async () => container.querySelector('button')!.click())
  expect(container.querySelectorAll('a')).toHaveLength(2)
  await act(async () => root.render(createElement(MaterialLibrary, { products: [], storeSlug: 'loja' })))
  expect(container.textContent).toContain('Nenhum material liberado ainda')
  await act(async () => root.unmount()); container.remove()
})

it('expõe o sumário realmente aberto no desktop e recolhido ao mudar para celular', async () => {
  const { LessonSidebar } = await import('@/components/membros/lesson-sidebar')
  const { vi } = await import('vitest')
  let desktop = true
  let changed = () => {}
  vi.stubGlobal('matchMedia', () => ({ matches: desktop, addEventListener: (_: string, callback: () => void) => { changed = callback }, removeEventListener: () => {} }))
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(createElement(LessonSidebar, { storeSlug: 'loja', modules: [{ id: 'm', productId: 'p', title: 'Módulo', sortOrder: 0, isPublished: true, items: [{ id: 'i', moduleId: 'm', title: 'Arquivo', kind: 'arquivo', url: 'https://example.com/a.pdf', coverUrl: null, sortOrder: 0, isPublished: true }] }] })))
  expect(container.querySelector('details')?.open).toBe(true)
  await act(async () => { desktop = false; changed() })
  expect(container.querySelector('details')?.open).toBe(false)
  expect(container.querySelectorAll('aside')).toHaveLength(1)
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals()
})
