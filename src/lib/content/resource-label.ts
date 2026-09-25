import type { Item } from '@/lib/domain/types'

const FORMATS = new Set(['pdf', 'zip', 'dwg', 'skp', 'xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt', 'png', 'jpg', 'jpeg'])

export function resourceLabel(item: Pick<Item, 'kind' | 'url'>): { typeLabel: string; actionLabel: string } {
  const actionLabel = 'Acesse seu conteúdo'
  if (item.kind === 'link') return { typeLabel: 'Link externo', actionLabel }
  if (item.kind !== 'arquivo') return { typeLabel: 'Conteúdo', actionLabel }

  try {
    const pathname = decodeURIComponent(new URL(item.url).pathname)
    const extension = pathname.split('/').at(-1)?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
    if (extension && FORMATS.has(extension)) {
      const format = extension.toUpperCase()
      return { typeLabel: format, actionLabel }
    }
  } catch {
    // A broken URL or escape sequence cannot establish a file format.
  }
  return { typeLabel: 'Arquivo', actionLabel }
}
