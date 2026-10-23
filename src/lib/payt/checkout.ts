/** Canonical authenticated Payt identifiers. No redirects or network lookups. */
export function normalizeCheckoutUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const input = value.trim()
  // Keep canonicalization identical to SQL; reject credentials, ports, whitespace,
  // escapes and dot segments rather than accepting URL parser repairs.
  const match = /^https:\/\/(payt\.site|checkout\.payt\.com\.br)(\/[^?#]*)?(?:[?#].*)?$/i.exec(input)
  if (!match || /[\\\s%]/.test(match[2] ?? '')) return null
  const path = (match[2] ?? '').replace(/\/+$/, '')
  if (!path || path.split('/').some(part => part === '.' || part === '..')) return null
  return `https://${match[1].toLowerCase()}${path}`
}

export function normalizeUpsellCode(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const code = String(value).trim()
  return code && !/\s/.test(code) ? code : null
}
