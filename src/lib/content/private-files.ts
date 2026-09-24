export const PRIVATE_FILES_BUCKET = 'arquivos-restritos'

const privatePrefix = `/storage/v1/object/authenticated/${PRIVATE_FILES_BUCKET}/`
const publicPrefix = '/storage/v1/object/public/arquivos/'

function segments(path: string): string[] {
  const parts = path.split('/')
  if (!parts.length || parts.some((part) => !part || part === '.' || part === '..' || part.includes('\\') || part.includes('/') || /[\u0000-\u001f\u007f]/.test(part))) {
    throw new Error('Caminho de arquivo inválido.')
  }
  return parts
}

function ownUrl(url: string, supabaseUrl: string): URL | null {
  try {
    const parsed = new URL(url)
    const own = new URL(supabaseUrl)
    if (parsed.origin !== own.origin || parsed.username || parsed.password || parsed.search || parsed.hash) return null
    return parsed
  } catch {
    return null
  }
}

export function privateFileUrl(supabaseUrl: string, path: string): string {
  const origin = new URL(supabaseUrl).origin
  return `${origin}${privatePrefix}${segments(path).map(encodeURIComponent).join('/')}`
}

export function privateFilePath(url: string, supabaseUrl: string): string | null {
  if (/(?:^|\/)(?:\.|%2e){1,2}(?:\/|$)/i.test(url)) return null
  const parsed = ownUrl(url, supabaseUrl)
  if (!parsed || !parsed.pathname.startsWith(privatePrefix)) return null
  try {
    const encoded = parsed.pathname.slice(privatePrefix.length).split('/')
    const decoded = encoded.map(decodeURIComponent)
    const path = decoded.join('/')
    segments(path)
    return path
  } catch {
    return null
  }
}

export function isLegacyPublicFileUrl(url: string, supabaseUrl: string): boolean {
  const parsed = ownUrl(url, supabaseUrl)
  if (!parsed || !parsed.pathname.startsWith(publicPrefix)) return false
  try {
    segments(parsed.pathname.slice(publicPrefix.length).split('/').map(decodeURIComponent).join('/'))
    return true
  } catch {
    return false
  }
}
