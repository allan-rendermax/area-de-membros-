import { getResourceDestination } from '@/lib/content/resource'
import { privateFilePath, PRIVATE_FILES_BUCKET } from '@/lib/content/private-files'
import type { Item } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

const privatePrefix = `/storage/v1/object/authenticated/${PRIVATE_FILES_BUCKET}/`

export async function resolveResourceDestination(item: Pick<Item, 'kind' | 'url'>, supabaseUrl: string): Promise<string | null> {
  let source: URL
  let configured: URL
  try {
    source = new URL(item.url)
    configured = new URL(supabaseUrl)
  } catch {
    return null
  }

  if (source.origin === configured.origin && source.pathname.startsWith(privatePrefix)) {
    if (item.kind !== 'arquivo') return null
    const path = privateFilePath(item.url, supabaseUrl)
    if (!path) return null
    try {
      const { data, error } = await createAdminClient().storage.from(PRIVATE_FILES_BUCKET).createSignedUrl(path, 60, { download: true })
      if (error || !data?.signedUrl) return null
      const signed = new URL(data.signedUrl, configured.origin)
      return signed.protocol === 'https:' || signed.protocol === 'http:' ? signed.toString() : null
    } catch {
      return null
    }
  }

  return getResourceDestination(item, supabaseUrl)
}
