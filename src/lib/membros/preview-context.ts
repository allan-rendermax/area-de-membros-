import type { AccessLevel } from '@/lib/domain/types'

export type PreviewMode = 'editorial' | 'basic' | 'complete' | 'locked'
export type PreviewContext = boolean | PreviewMode

/** Context only; every preview route must additionally authorize the administrator. */
export function previewContext(query: { previa?: string | string[]; simular?: string | string[] }): PreviewContext {
  if (query.previa !== '1') return false
  return query.simular === 'basic' || query.simular === 'complete' || query.simular === 'locked'
    ? query.simular : 'editorial'
}

export function previewIncludesDrafts(preview: PreviewContext): boolean {
  return preview === true || preview === 'editorial'
}

export function previewAccessLevel(preview: PreviewContext): AccessLevel | undefined {
  if (!preview || preview === 'locked') return undefined
  return preview === 'basic' ? 'basic' : 'complete'
}
