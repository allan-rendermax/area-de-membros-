import type { Item } from '@/lib/domain/types'

const PUBLIC_FILES_PREFIX = '/storage/v1/object/public/arquivos/'

export function getResourceDestination(item: Pick<Item, 'kind' | 'url'>, supabaseUrl: string): string | null {
  if (item.kind === 'video') return null

  let destination: URL
  try {
    destination = new URL(item.url)
  } catch {
    return null
  }
  if (destination.protocol !== 'http:' && destination.protocol !== 'https:') return null
  if (item.kind === 'link') return item.url

  try {
    const configured = new URL(supabaseUrl)
    if (destination.origin === configured.origin && destination.pathname.startsWith(PUBLIC_FILES_PREFIX) && destination.pathname.length > PUBLIC_FILES_PREFIX.length) {
      destination.searchParams.set('download', '')
      return destination.toString()
    }
  } catch {
    // A malformed configuration must not rewrite an external destination.
  }
  return item.url
}
