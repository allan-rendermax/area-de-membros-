import { RESERVED_STORE_SLUGS } from '@/lib/content/slug'

export function withPreview(href: string, preview = false): string {
  if (!preview) return href
  const [path, hash] = href.split('#')
  return `${path}${path.includes('?') ? '&' : '?'}previa=1${hash === undefined ? '' : `#${hash}`}`
}

export function protectedStoreSlug(pathname: string): string | null {
  const [first, second] = pathname.split('/').filter(Boolean)
  if (!first || RESERVED_STORE_SLUGS.has(first)) return null
  if (second === 'entrar' || second === 'manifest.webmanifest') return null
  return first
}
