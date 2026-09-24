import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getResourceDestination } from '@/lib/content/resource'
import { ResourceList } from '@/components/membros/resource-list'
import { ItemAnchor } from '@/components/membros/episode-card'
import type { Item } from '@/lib/domain/types'

const supabase = 'https://project.supabase.co'
const file: Item = { id: '11111111-1111-4111-8111-111111111111', moduleId: 'module-a', title: 'Apostila com um título bastante extenso para identificação do material', kind: 'arquivo', url: `${supabase}/storage/v1/object/public/arquivos/aula.pdf?token=1`, coverUrl: null, sortOrder: 0, isPublished: true }
const link: Item = { ...file, id: '22222222-2222-4222-8222-222222222222', title: 'Versão editável', kind: 'link', url: 'https://drive.example.com/doc?open=1' }

describe('destino de recursos', () => {
  it('pede download apenas de arquivo público no bucket da origem Supabase configurada', () => {
    expect(getResourceDestination(file, supabase)).toBe(`${supabase}/storage/v1/object/public/arquivos/aula.pdf?token=1&download=`)
    expect(getResourceDestination({ ...file, url: 'https://project.supabase.co.evil.test/storage/v1/object/public/arquivos/aula.pdf' }, supabase)).toBe('https://project.supabase.co.evil.test/storage/v1/object/public/arquivos/aula.pdf')
    expect(getResourceDestination({ ...file, url: `${supabase}/storage/v1/object/public/outro/aula.pdf` }, supabase)).toBe(`${supabase}/storage/v1/object/public/outro/aula.pdf`)
  })

  it('preserva link externo e query intactos e recusa vídeo ou URL insegura', () => {
    expect(getResourceDestination(link, supabase)).toBe(link.url)
    expect(getResourceDestination({ ...file, url: 'https://outro.example.com/a.pdf?x=1' }, supabase)).toBe('https://outro.example.com/a.pdf?x=1')
    expect(getResourceDestination({ ...file, kind: 'video' }, supabase)).toBeNull()
    expect(getResourceDestination({ ...file, url: 'javascript:alert(1)' }, supabase)).toBeNull()
  })
})

describe('lista e navegação de recursos', () => {
  it('exibe nomes e ações de arquivo/link usando somente href interno e omite URL inválida', () => {
    const html = renderToStaticMarkup(createElement(ResourceList, { items: [file, link, { ...file, id: 'bad', url: 'data:text/plain,a' }], storeSlug: 'loja-a', currentItemId: link.id }))
    expect(html).toContain(file.title)
    expect(html).toContain('Baixar')
    expect(html).toContain('Abrir link')
    expect(html).toContain(`href="/loja-a/item/${file.id}/abrir"`)
    expect(html).toContain(`href="/loja-a/item/${link.id}/abrir"`)
    expect(html).not.toContain(file.url)
    expect(html).not.toContain(link.url)
    expect(html).not.toContain('href="/loja-a/item/bad/abrir"')
    expect(html).toContain('Baixar PDF')
    expect(html).toContain('PDF')
    expect(html).not.toContain('hidden shrink-0 text-sm font-semibold text-destaque')
  })

  it('abre a página interna de arquivo na mesma aba', () => {
    const html = renderToStaticMarkup(ItemAnchor({ item: file, storeSlug: 'loja-a', className: 'x', children: 'Abrir material' }))
    expect(html).toContain(`href="/loja-a/item/${file.id}"`)
    expect(html).not.toContain('target="_blank"')
  })

  it('preserva os rótulos originais na lista do produto', () => {
    const html = renderToStaticMarkup(createElement(ResourceList, { items: [file, link], storeSlug: 'loja-a', legacyPresentation: true }))
    expect(html).toContain('Arquivo')
    expect(html).toContain(`aria-label="Baixar ${file.title}"`)
    expect(html).not.toContain('Baixar PDF')
    expect(html).not.toContain('>PDF</span>')
  })
})
