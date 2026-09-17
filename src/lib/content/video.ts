export type VideoEmbed = { provider: 'youtube' | 'vimeo' | 'panda'; embedUrl: string }

function youtubeId(url: URL, host: string): string | null {
  const valid = (id: string | null | undefined) => (id && /^[\w-]{11}$/.test(id) ? id : null)
  if (host === 'youtu.be') return valid(url.pathname.slice(1).split('/')[0])
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') return valid(url.searchParams.get('v'))
    const [kind, id] = url.pathname.split('/').filter(Boolean)
    if (kind === 'embed' || kind === 'shorts' || kind === 'live') return valid(id)
  }
  return null
}

export function toVideoEmbed(raw: string): VideoEmbed | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.replace(/^(www|m)\./, '')

  const ytId = youtubeId(url, host)
  if (ytId) return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}` }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const index = parts.findIndex((p) => /^\d+$/.test(p))
    if (index === -1) return null
    const next = parts[index + 1]
    const hash = url.searchParams.get('h') ?? (next && /^[a-f0-9]+$/i.test(next) ? next : null)
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${parts[index]}${hash ? `?h=${hash}` : ''}` }
  }

  if (host.endsWith('pandavideo.com.br')) {
    const v = url.searchParams.get('v')
    if (!v || !/^[0-9a-f-]{36}$/i.test(v)) return null
    return { provider: 'panda', embedUrl: `https://${url.hostname}/embed/?v=${v}` }
  }

  return null
}
