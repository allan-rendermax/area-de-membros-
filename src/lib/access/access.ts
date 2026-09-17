import type { OrderRef, Product, ProductLink } from '@/lib/domain/types'

export function grantedProductIds(orders: OrderRef[], links: ProductLink[], blocked: boolean): Set<string> {
  const granted = new Set<string>()
  if (blocked) return granted

  const paidCodes = new Set(orders.filter((o) => o.status === 'pago').map((o) => o.productCode))
  for (const link of links) {
    if (paidCodes.has(link.productCode)) granted.add(link.productId)
  }
  return granted
}

export type ShelfProduct = {
  id: string
  slug: string
  title: string
  description: string
  coverUrl: string | null
  bannerUrl: string | null
  unlocked: boolean
  checkoutUrl: string | null
}

export type Shelf = { featured: ShelfProduct | null; unlocked: ShelfProduct[]; locked: ShelfProduct[] }

export function buildShelf(products: Product[], granted: Set<string>): Shelf {
  const visible = products.filter((p) => p.isPublished).sort((a, b) => a.sortOrder - b.sortOrder)
  const all: ShelfProduct[] = visible.map((p) => {
    const unlocked = granted.has(p.id)
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      coverUrl: p.coverUrl,
      bannerUrl: p.bannerUrl,
      unlocked,
      checkoutUrl: unlocked ? null : p.checkoutUrl,
    }
  })
  const unlocked = all.filter((p) => p.unlocked)
  const locked = all.filter((p) => !p.unlocked)
  const featuredId = visible.find((p) => p.isFeatured)?.id
  const featured = all.find((p) => p.id === featuredId) ?? unlocked[0] ?? locked[0] ?? null
  return { featured, unlocked, locked }
}
