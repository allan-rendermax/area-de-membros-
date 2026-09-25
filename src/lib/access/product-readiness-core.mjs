import { toVideoEmbed } from '../content/video-embed.mjs'

/** @param {import('./product-readiness').ReadinessModule['items'][number]} item */
function usableItem(item) {
  if (!item.isPublished || !['arquivo', 'link', 'video'].includes(item.kind)) return false
  try {
    const url = new URL(item.url)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return false
    return item.kind !== 'video' || toVideoEmbed(item.url) !== null
  } catch {
    return false
  }
}

/** @param {import('./product-readiness').ReadinessInput} input
 * @returns {import('./product-readiness').ProductReadiness} */
export function assessProductReadiness({ mode, modules, offeredLevels }) {
  const itemCounts = { basic: 0, complete: 0 }
  for (const section of modules) {
    if (!section.isPublished) continue
    const count = section.items.filter(usableItem).length
    const level = section.requiredLevel ?? 'basic'
    itemCounts[level] += count
    if (mode === 'sections' && level === 'basic') itemCounts.complete += count
  }
  return { emptyLevels: [...new Set(offeredLevels)].filter(level => itemCounts[level] === 0), itemCounts }
}
