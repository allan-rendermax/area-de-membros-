import { materialTitle } from '@/lib/content/material-title'

type DownloadSource = { url: string; title?: string }

function clean(value: string): string {
  return value.normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[ .-]+|[ .-]+$/g, '')
}

function key(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export function resourceDownloadName(item: DownloadSource, productTitle = ''): string {
  let storedName = ''
  try { storedName = decodeURIComponent(new URL(item.url).pathname.split('/').at(-1) ?? '') } catch { /* Use the material title below. */ }
  const extension = /\.[a-z0-9]{1,12}$/i.exec(storedName)?.[0].toLowerCase() ?? ''
  const product = clean(extension && productTitle.toLowerCase().endsWith(extension) ? productTitle.slice(0, -extension.length) : productTitle)
  let title = materialTitle(item.title, productTitle)
    .replace(/^baixa(?:r|e)\s+(?:o\s+)?arquivo\s+editável\s*[—–-]\s*/i, '')
    .replace(/\s*\((?:Word|Excel|PDF)\)\s*$/i, '')
    .replace(/\s+[—–-]\s*(?:baixe|extraia|abra)\b.*$/i, '')
  if (extension && title.toLowerCase().endsWith(extension)) title = title.slice(0, -extension.length)
  title = clean(title) || product || clean(storedName.slice(0, extension ? -extension.length : undefined)) || 'Material'

  const titleKey = key(title)
  const productKey = key(product)
  if (productKey && titleKey && productKey.startsWith(`${titleKey} `)) title = product
  else if (productKey && titleKey !== productKey && !titleKey.startsWith(`${productKey} `)) title = `${product} - ${title}`

  if (/^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])$/i.test(title.split('.')[0].trim())) title = `Material - ${title}`
  const encoder = new TextEncoder()
  const budget = 180 - encoder.encode(extension).length
  let stem = ''
  for (const character of title) {
    if (encoder.encode(stem + character).length > budget) break
    stem += character
  }
  return `${stem.replace(/[ .-]+$/g, '')}${extension}`
}
