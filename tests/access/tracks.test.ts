import { describe, expect, it } from 'vitest'
import { buildShelf, buildTracks } from '@/lib/access/access'
import type { Product } from '@/lib/domain/types'

function product(id: string, track: string, sortOrder: number, extra: Partial<Product> = {}): Product {
  return {
    id, storeId: 's1', slug: id, title: id, description: '', track,
    coverUrl: null, bannerUrl: null, checkoutUrl: `https://payt/${id}`,
    role: 'front', isFeatured: false, sortOrder, isPublished: true, ...extra,
  }
}

function rows(products: Product[], granted: string[] = []) {
  return buildTracks(buildShelf(products, new Set(granted))).map((track) => ({
    name: track.name,
    ids: track.products.map((p) => p.id),
  }))
}

describe('buildTracks', () => {
  it('preserva prioridade complementar dentro da trilha sem reordenar os comprados', () => {
    expect(rows([product('front', 'A', 0), product('comprado', 'A', 1),
      product('orderbump', 'A', 2, { role: 'orderbump' }),
      product('upsell', 'A', 4, { role: 'upsell' }),
      product('rascunho', 'A', -1, { role: 'upsell', isPublished: false })], ['comprado']))
      .toEqual([{ name: 'A', ids: ['comprado', 'orderbump', 'upsell', 'front'] }])
  })
  it('agrupa por trilha e ordena liberados antes de bloqueados, por sortOrder em cada grupo', () => {
    expect(rows([
      product('liberado-tarde', 'Patologias', 9),
      product('bloqueado-tarde', 'Patologias', 3),
      product('outra', 'Detalhamento', 10),
      product('bloqueado-cedo', 'Patologias', 1),
      product('liberado-cedo', 'Patologias', 5, { isFeatured: true }),
    ], ['liberado-tarde', 'liberado-cedo'])).toEqual([
      { name: 'Patologias', ids: ['liberado-cedo', 'liberado-tarde', 'bloqueado-cedo', 'bloqueado-tarde'] },
      { name: 'Detalhamento', ids: ['outra'] },
    ])
  })

  it('trilha com liberado vem antes de trilha só com bloqueados', () => {
    expect(rows([
      product('bloqueado', 'Detalhamento', 0),
      product('liberado', 'Patologias', 100),
    ], ['liberado'])).toEqual([
      { name: 'Patologias', ids: ['liberado'] },
      { name: 'Detalhamento', ids: ['bloqueado'] },
    ])
  })

  it('trilha bloqueada com oferta complementar precede trilha bloqueada apenas front', () => {
    expect(rows([product('front', 'A', 0), product('bump', 'B', 2, { role: 'orderbump' })]))
      .toEqual([{ name: 'B', ids: ['bump'] }, { name: 'A', ids: ['front'] }])
  })

  it('ordena trilhas de cada grupo pela menor sortOrder, incluindo produtos bloqueados', () => {
    expect(rows([
      product('a', 'A', 5), product('z', 'Z', 20), product('z-bloqueado', 'Z', 1),
      product('b', 'B', 9), product('y', 'Y', 2),
    ], ['a', 'z']).map((track) => track.name)).toEqual(['Z', 'A', 'Y', 'B'])
  })

  it.each([{ granted: [] }, { granted: ['z', 'a', 'b'] }])('desempata sortOrder pelo nome em ordem alfabética pt-BR (liberados: $granted)', ({ granted }) => {
    expect(rows([
      product('z', 'Zoologia', 1), product('b', 'Biologia', 1), product('a', 'Álgebra', 1),
    ], granted).map((track) => track.name)).toEqual(['Álgebra', 'Biologia', 'Zoologia'])
  })

  it('produto sem trilha cai em Outros quando há outras trilhas', () => {
    expect(rows([product('sem', '', 2), product('com', 'Patologias', 1)])).toEqual([
      { name: 'Patologias', ids: ['com'] }, { name: 'Outros', ids: ['sem'] },
    ])
  })

  it('todos sem trilha ficam em uma única trilha Seus produtos', () => {
    expect(rows([product('bloqueado', '', 0), product('liberado', '', 1)], ['liberado'])).toEqual([
      { name: 'Seus produtos', ids: ['liberado', 'bloqueado'] },
    ])
  })

  it('produto não publicado não aparece nem influencia o nome da trilha', () => {
    expect(rows([
      product('oculto', 'Patologias', 0, { isPublished: false, isFeatured: true }),
      product('visivel', '', 1),
    ], ['oculto'])).toEqual([{ name: 'Seus produtos', ids: ['visivel'] }])
  })

  it('não cria trilhas para uma vitrine vazia', () => {
    expect(rows([])).toEqual([])
  })

  it('não modifica a vitrine recebida', () => {
    const shelf = buildShelf([product('b', 'Patologias', 0), product('a', 'Patologias', 1)], new Set(['a']))
    const original = structuredClone(shelf)
    buildTracks(shelf)
    expect(shelf).toEqual(original)
  })
})
