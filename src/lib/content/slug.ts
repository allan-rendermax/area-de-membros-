export const RESERVED_STORE_SLUGS: ReadonlySet<string> = new Set([
  'admin', 'api', 'entrar', 'sair', '_next', 'favicon.ico', 'manifest.webmanifest', 'sw.js', 'icons',
])

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug)
}

export function isReservedStoreSlug(slug: string): boolean {
  return RESERVED_STORE_SLUGS.has(slug)
}

export function isValidStoreSlug(slug: string): boolean {
  return isValidSlug(slug) && !isReservedStoreSlug(slug)
}
