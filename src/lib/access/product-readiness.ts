import type { AccessLevel, ContentMode, ItemKind } from '@/lib/domain/types'
import { assessProductReadiness as assess } from './product-readiness-core.mjs'

export type ReadinessModule = {
  isPublished: boolean
  requiredLevel?: AccessLevel
  items: { isPublished: boolean; kind: ItemKind; url: string }[]
}

export type ReadinessInput = { mode: ContentMode; modules: ReadinessModule[]; offeredLevels: AccessLevel[] }
export type ProductReadiness = { emptyLevels: AccessLevel[]; itemCounts: Record<AccessLevel, number> }

export function assessProductReadiness(input: ReadinessInput): ProductReadiness {
  return assess(input)
}
