const LOCAL_RASTER_EXTENSION = /\.(?:png|jpe?g|webp|avif)$/
const REMOTE_RASTER_EXTENSION = /\.(?:png|jpe?g|webp|avif)$/i
const SUPABASE_PROJECT_HOST = /^[^.]+\.supabase\.co$/i
const PUBLIC_COVERS_PREFIX = '/storage/v1/object/public/covers/'

export function isOptimizableImage(src: string): boolean {
  if (!src || src.includes('\\') || src.includes('?') || src.includes('#')) return false

  if (src.startsWith('/')) {
    return !src.startsWith('//') && LOCAL_RASTER_EXTENSION.test(src)
  }

  const authority = /^https:\/\/([^/?#]+)/i.exec(src)?.[1]
  if (!authority || authority.includes(':')) return false

  let url: URL
  try {
    url = new URL(src)
  } catch {
    return false
  }

  return url.protocol === 'https:'
    && SUPABASE_PROJECT_HOST.test(url.hostname)
    && url.port === ''
    && url.username === ''
    && url.password === ''
    && url.pathname.startsWith(PUBLIC_COVERS_PREFIX)
    && REMOTE_RASTER_EXTENSION.test(url.pathname)
    && url.search === ''
    && url.hash === ''
}
