import { describe, expect, it } from 'vitest'
import { getMemberTheme, withMemberArtwork } from '@/lib/membros/theme'
import type { Product } from '@/lib/domain/types'

const product: Product = { id: 'p', storeId: 's', slug: 'atlas-visual-das-patologias', title: 'Atlas', track: 'Patologias', description: '', coverUrl: null, bannerUrl: null, checkoutUrl: null, isFeatured: true, sortOrder: 0, isPublished: true }

describe('isolamento visual da arquitetura', () => {
  it('ativa apenas o slug exato, sem inferir pelo nome ou substring', () => {
    expect(getMemberTheme('arquitetura')).toBe('arquitetura')
    for (const slug of ['outra-loja', 'admin', 'arquitetura-2', 'Arquitetura', '']) expect(getMemberTheme(slug)).toBeUndefined()
  })
  it('adiciona artes padrão só à loja arquitetura e não muda produto original', () => {
    const styled = withMemberArtwork(product, 'arquitetura')
    expect(styled.coverUrl).toBe('/themes/arquitetura/atlas.webp')
    expect(styled.bannerUrl).toBe('/themes/arquitetura/hero.webp')
    expect(product.coverUrl).toBeNull()
    expect(withMemberArtwork(product, 'outra-loja')).toBe(product)
    expect(styled.id).toBe(product.id)
    expect(styled.checkoutUrl).toBeNull()
  })
  it('preserva imagens do painel e não atribui capa de outro produto', () => {
    const custom = { ...product, coverUrl: '/custom.webp', bannerUrl: '/banner.webp', unlocked: false }
    expect(withMemberArtwork(custom, 'arquitetura')).toEqual(custom)
    expect(withMemberArtwork({ ...product, slug: 'produto-futuro' }, 'arquitetura').coverUrl).toBeNull()
    expect(withMemberArtwork({ ...product, slug: 'bonus-atlas-patologias' }, 'arquitetura').coverUrl).toBe('/themes/arquitetura/bonus.webp')
  })
  it('mantém a capa cadastrada como fallback do banner', () => {
    expect(withMemberArtwork({ ...product, coverUrl: '/custom.webp' }, 'arquitetura').bannerUrl).toBe('/custom.webp')
  })
  it('trata nomes de propriedades de Object como slugs desconhecidos', () => {
    for (const slug of ['constructor', 'toString', '__proto__']) {
      expect(withMemberArtwork({ ...product, slug }, 'arquitetura').coverUrl).toBeNull()
    }
  })
})
