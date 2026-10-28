import { getResourceDestination } from '@/lib/content/resource'
import { resourceDownloadName } from '@/lib/content/download-name'
import { privateFilePath, PRIVATE_FILES_BUCKET } from '@/lib/content/private-files'
import type { Item } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

const privatePrefix = `/storage/v1/object/authenticated/${PRIVATE_FILES_BUCKET}/`
export const DOWNLOAD_URL_TTL_SECONDS = 15 * 60

export async function resolveResourceDestination(item: Pick<Item, 'kind' | 'url'> & Partial<Pick<Item, 'title'>>, supabaseUrl: string, productTitle = ''): Promise<string | null> {
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
      const { data, error } = await createAdminClient().storage.from(PRIVATE_FILES_BUCKET).createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS, { download: true })
      if (error || !data?.signedUrl) return null
      const signed = new URL(data.signedUrl, configured.origin)
      // Set the raw filename after signing: the SDK double-encodes Unicode download options.
      signed.searchParams.set('download', resourceDownloadName(item, productTitle))
      return signed.protocol === 'https:' || signed.protocol === 'http:' ? signed.toString() : null
    } catch {
      return null
    }
  }

  return getResourceDestination(item, supabaseUrl, productTitle)
}
