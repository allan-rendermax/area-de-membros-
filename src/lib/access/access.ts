import type { Material, OfferLink, OrderRef } from '@/lib/domain/types'

export type VitrineItem = {
  id: string
  title: string
  description: string
  coverUrl: string | null
} & ({ unlocked: true; downloadUrl: string } | { unlocked: false; checkoutUrl: string | null })

export function grantedMaterialIds(orders: OrderRef[], links: OfferLink[], blocked: boolean): Set<string> {
  const granted = new Set<string>()
  if (blocked) return granted

  const paidCodes = new Set(orders.filter((o) => o.status === 'pago').map((o) => o.productCode))
  for (const link of links) {
    if (paidCodes.has(link.productCode)) granted.add(link.materialId)
  }
  return granted
}

export function buildVitrine(
  materials: Material[],
  granted: Set<string>,
): { unlocked: VitrineItem[]; locked: VitrineItem[] } {
  const visible = materials.filter((m) => m.isPublished).sort((a, b) => a.sortOrder - b.sortOrder)
  const unlocked: VitrineItem[] = []
  const locked: VitrineItem[] = []

  for (const m of visible) {
    const base = { id: m.id, title: m.title, description: m.description, coverUrl: m.coverUrl }
    if (granted.has(m.id)) unlocked.push({ ...base, unlocked: true, downloadUrl: m.downloadUrl })
    else locked.push({ ...base, unlocked: false, checkoutUrl: m.checkoutUrl })
  }
  return { unlocked, locked }
}
