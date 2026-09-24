import type { AccessLevel, OrderRef, Product, ProductLink, ProductRole } from '@/lib/domain/types'

function lockedPriority(role: ProductRole = 'front'): number {
  return role === 'front' ? 1 : 0
}

export function grantedProductIds(orders: OrderRef[], links: ProductLink[], blocked: boolean): Set<string> {
  return new Set(grantedProductLevels(orders, links, blocked).keys())
}

export function grantedProductLevels(orders: OrderRef[], links: ProductLink[], blocked: boolean): Map<string, AccessLevel> {
  const granted = new Map<string, AccessLevel>()
  if (blocked) return granted
  const paidCodes = new Set(orders.filter((o) => o.status === 'pago').map((o) => o.productCode))
  for (const link of links) {
    if (!paidCodes.has(link.productCode)) continue
    const level = link.grantLevel ?? 'complete'
    if (level === 'complete' || !granted.has(link.productId)) granted.set(link.productId, level)
  }
  return granted
}

export function canAccessLevel(granted: AccessLevel | undefined, required: AccessLevel = 'basic'): boolean {
  return granted === 'complete' || (granted === 'basic' && required === 'basic')
}

export type ShelfProduct = {
  id: string
  slug: string
  title: string
  track: string
  sortOrder: number
  description: string
  coverUrl: string | null
  bannerUrl: string | null
  unlocked: boolean
  checkoutUrl: string | null
  role?: ProductRole
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
      track: p.track,
      sortOrder: p.sortOrder,
      description: p.description,
      coverUrl: p.coverUrl,
      bannerUrl: p.bannerUrl,
      unlocked,
      checkoutUrl: unlocked ? null : p.checkoutUrl,
      role: p.role,
    }
  })
  const unlocked = all.filter((p) => p.unlocked)
  const locked = all.filter((p) => !p.unlocked)
    .sort((a, b) => lockedPriority(a.role) - lockedPriority(b.role) || a.sortOrder - b.sortOrder)
  const featuredId = visible.find((p) => p.isFeatured)?.id
  const featured = all.find((p) => p.id === featuredId) ?? unlocked[0] ?? all.find((p) => !p.unlocked) ?? null
  return { featured, unlocked, locked }
}

export type Track = { name: string; products: ShelfProduct[] }

export function buildTracks(shelf: Shelf): Track[] {
  const products = [...shelf.unlocked, ...shelf.locked]
  const allUntracked = products.every((p) => !p.track.trim())
  const groups = new Map<string, ShelfProduct[]>()

  for (const product of products) {
    const name = product.track.trim() || (allUntracked ? 'Seus produtos' : 'Outros')
    const group = groups.get(name)
    if (group) group.push(product)
    else groups.set(name, [product])
  }

  return [...groups].map(([name, products]) => ({
    name,
    products: products.sort((a, b) => Number(b.unlocked) - Number(a.unlocked)
      || (!a.unlocked ? lockedPriority(a.role) - lockedPriority(b.role) : 0)
      || a.sortOrder - b.sortOrder),
    hasUnlocked: products.some((p) => p.unlocked),
    lockedPriority: Math.min(...products.filter((p) => !p.unlocked).map((p) => lockedPriority(p.role)), 1),
    minSortOrder: products.reduce((min, p) => Math.min(min, p.sortOrder), Infinity),
  })).sort((a, b) =>
    Number(b.hasUnlocked) - Number(a.hasUnlocked)
    || (!a.hasUnlocked ? a.lockedPriority - b.lockedPriority : 0)
    || a.minSortOrder - b.minSortOrder
    || a.name.localeCompare(b.name, 'pt-BR'),
  ).map(({ name, products }) => ({ name, products }))
}
