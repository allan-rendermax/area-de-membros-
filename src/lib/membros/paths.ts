import { RESERVED_STORE_SLUGS } from '@/lib/content/slug'

export function protectedStoreSlug(pathname: string): string | null {
  const [first, second] = pathname.split('/').filter(Boolean)
  if (!first || RESERVED_STORE_SLUGS.has(first)) return null
  if (second === 'entrar' || second === 'manifest.webmanifest') return null
  return first
}
