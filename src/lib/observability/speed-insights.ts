/** Keep credentials, customer identifiers and administrative previews out of telemetry. */
export function sanitizeSpeedInsightsEvent<T extends { url: string }>(event: T): T | null {
  try {
    const url = new URL(event.url)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (/^\/(admin|api)(\/|$)/.test(url.pathname) || url.searchParams.has('previa') || url.searchParams.has('simular')) return null
    url.search = ''
    url.hash = ''
    url.username = ''
    url.password = ''
    return { ...event, url: url.toString() }
  } catch {
    return null
  }
}
