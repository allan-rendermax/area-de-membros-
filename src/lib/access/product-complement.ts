import { previewIncludesDrafts, type PreviewContext } from '@/lib/membros/preview-context'
import type { Product } from '@/lib/domain/types'
import { isHttpUrl } from '@/lib/content/url'
import { withPreview } from '@/lib/membros/paths'
import type { ShelfProduct, Track } from './access'

export type ProductComplement = { product: Product; owned: boolean; href: string | null; external: boolean }

export function preferredCheckoutUrl(product: Pick<Product, 'studentCheckoutUrl' | 'checkoutUrl'>): string | null {
  return [product.studentCheckoutUrl, product.checkoutUrl].find((url) => url && isHttpUrl(url)) ?? null
}

export function resolveProductComplement(source: Product, products: Product[], granted: Set<string>, storeSlug: string, preview: PreviewContext = false): ProductComplement | null {
  const target = products.find((product) => product.id === source.complementaryProductId && product.id !== source.id && product.storeId === source.storeId && (previewIncludesDrafts(preview) || product.isPublished))
  if (!target) return null
  const owned = preview ? preview !== 'locked' : granted.has(target.id)
  return { product: target, owned, href: owned ? withPreview(`/${storeSlug}/produto/${target.slug}`, preview) : preferredCheckoutUrl(target), external: !owned }
}

// Only visible products participate. A shared target belongs to the first valid pair.
export function arrangeComplementaryTracks(tracks: Track[]): Track[] {
  const all = tracks.flatMap((track) => track.products)
  const pairs = selectComplementaryPairs(all)
  if (pairs.length === 0) return tracks
  const placed = new Set(pairs.flatMap(([source, target]) => [source.id, target.id]))
  const promoted = new Map<string, ShelfProduct[]>()
  const ownerTrack = new Map(all.map((product) => [product.id, tracks.find((track) => track.products.includes(product))!.name]))
  for (const [source, target] of pairs) {
    const name = ownerTrack.get(source.id)!
    promoted.set(name, [...(promoted.get(name) ?? []), source, target])
  }
  return tracks.map((track) => ({
    name: track.name,
    products: [...(promoted.get(track.name) ?? []), ...track.products.filter((product) => !placed.has(product.id))],
  })).filter((track) => track.products.length > 0)
    .sort((a, b) => Number(promoted.has(b.name)) - Number(promoted.has(a.name)))
}

export function selectComplementaryPairs(products: ShelfProduct[]): [ShelfProduct, ShelfProduct][] {
  const byId = new Map(products.map((product) => [product.id, product]))
  const placed = new Set<string>()
  const pairs: [ShelfProduct, ShelfProduct][] = []
  for (const source of products) {
    const target = source.complementaryProductId ? byId.get(source.complementaryProductId) : undefined
    if (!target || target.id === source.id || placed.has(source.id) || placed.has(target.id)) continue
    pairs.push([source, target])
    placed.add(source.id)
    placed.add(target.id)
  }
  return pairs
}

export function findRequestedComplement(products: ShelfProduct[], targetIds: Set<string>, requestedSlug: string | null): ShelfProduct | null {
  if (!requestedSlug) return null
  return products.find((product) => product.slug === requestedSlug && !product.unlocked && targetIds.has(product.id)) ?? null
}
