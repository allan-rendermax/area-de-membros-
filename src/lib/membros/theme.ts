import type { Product } from '@/lib/domain/types'

export type MemberThemeName = 'arquitetura' | undefined
export const ARCHITECTURE_HERO = '/themes/arquitetura/hero.webp'

export function getMemberTheme(slug: string): MemberThemeName {
  return slug === 'arquitetura' ? 'arquitetura' : undefined
}

const covers = new Map([
  ['atlas-visual-das-patologias', '/themes/arquitetura/atlas.webp'],
  ['bonus-atlas-patologias', '/themes/arquitetura/bonus.webp'],
])

export function withMemberArtwork<T extends Product>(product: T, storeSlug: string): T {
  if (!getMemberTheme(storeSlug)) return product
  return {
    ...product,
    coverUrl: product.coverUrl ?? covers.get(product.slug) ?? null,
    bannerUrl: product.bannerUrl ?? product.coverUrl ?? ARCHITECTURE_HERO,
  }
}
