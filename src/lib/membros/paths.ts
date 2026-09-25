import { RESERVED_STORE_SLUGS } from '@/lib/content/slug'
import type { PreviewContext } from './preview-context'

export function withPreview(href: string, preview: PreviewContext = false): string {
  if (!preview) return href
  const [path, hash] = href.split('#')
  const simulation = typeof preview === 'string' && preview !== 'editorial' ? `&simular=${preview}` : ''
  return `${path}${path.includes('?') ? '&' : '?'}previa=1${simulation}${hash === undefined ? '' : `#${hash}`}`
}

export function protectedStoreSlug(pathname: string): string | null {
  const [first, second] = pathname.split('/').filter(Boolean)
  if (!first || RESERVED_STORE_SLUGS.has(first)) return null
  if (second === 'entrar' || second === 'manifest.webmanifest') return null
  return first
}
