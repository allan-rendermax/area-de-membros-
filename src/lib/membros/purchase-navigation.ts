import { projectContextualLibrary, type ContextualInput } from '@/lib/access/contextual-complements'
import { withPreview } from './paths'
import type { PreviewContext } from './preview-context'

export type PurchaseNavigation = {
  products: { id: string; title: string; href: string; current: boolean; role: 'principal' | 'complemento' }[]
  backParent: { title: string; href: string } | null
}

export function buildPurchaseNavigation(
  input: ContextualInput,
  currentProductId: string,
  storeSlug: string,
  preview?: PreviewContext,
  complementScenario?: string,
): PurchaseNavigation | null {
  const group = projectContextualLibrary(input).owned.find(group =>
    group.product.id === currentProductId || group.complements.some(product => product.id === currentProductId),
  )
  if (!group || group.complements.length === 0) return null

  const href = (slug: string) => withPreview(
    `/${encodeURIComponent(storeSlug)}/produto/${encodeURIComponent(slug)}`, preview, complementScenario,
  )
  return {
    products: [group.product, ...group.complements].map(product => ({
      id: product.id,
      title: product.title,
      href: href(product.slug),
      current: product.id === currentProductId,
      role: product.id === group.product.id ? 'principal' : 'complemento',
    })),
    backParent: currentProductId === group.product.id ? null : {
      title: group.product.title,
      href: href(group.product.slug),
    },
  }
}
