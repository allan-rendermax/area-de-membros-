import type { AccessLevel, ContentMode } from '@/lib/domain/types'
import { canAccessLevel } from './access'

export function canAccessProductModule(granted: AccessLevel | undefined, required: AccessLevel = 'basic', mode: ContentMode = 'sections', preview = false): boolean {
  if (preview) return true
  return mode === 'versions' ? Boolean(granted && granted === required) : canAccessLevel(granted, required)
}

export function sectionTitle(title: string, level: AccessLevel = 'basic', mode: ContentMode = 'sections'): string {
  const generic = !title.trim() || /^materiais$/i.test(title.trim()) || /^clique\s+aqui(?:\s+para\b.*)?[.!]?$/i.test(title.trim())
  if (!generic) return title
  return mode === 'versions' ? (level === 'complete' ? 'Completo' : 'Básico') : 'Materiais'
}
