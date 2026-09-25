import { toVideoEmbed as parseVideoEmbed } from './video-embed.mjs'

export type VideoEmbed = { provider: 'youtube' | 'vimeo' | 'panda'; embedUrl: string }

export function toVideoEmbed(raw: string): VideoEmbed | null {
  return parseVideoEmbed(raw)
}
