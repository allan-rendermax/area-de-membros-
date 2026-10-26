import type { Item } from '@/lib/domain/types'
import { resourceLabel } from './resource-label'

export function memberResourceLabel(
  item: Pick<Item, 'kind' | 'url' | 'title'>,
  productTitle?: string,
): { typeLabel: string; actionLabel: string } {
  const label = resourceLabel(item)
  if (label.typeLabel !== 'PDF') return label

  for (const title of [item.title, productTitle]) {
    if (!title) continue
    if (/\batlas\b/i.test(title)) return { typeLabel: 'Atlas', actionLabel: 'Abrir Atlas' }
    if (/\bguias?\b/i.test(title)) return { typeLabel: 'Guia', actionLabel: 'Abrir Guia' }
  }
  return { typeLabel: 'Material digital', actionLabel: 'Abrir material' }
}
