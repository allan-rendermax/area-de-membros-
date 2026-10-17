export function getCommunityWhatsappUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const candidate = value.trim()
  if (!/^https:\/\/[^/]/i.test(candidate)) return null
  if (candidate.includes('#')) return null
  if (/[\\\x00-\x20\x7f]/.test(candidate)) return null
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' || url.hostname !== 'chat.whatsapp.com' || url.username || url.password || url.port || url.hash || !/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return null
    return candidate
  } catch { return null }
}
