import { previewIncludesDrafts, type PreviewContext } from '@/lib/membros/preview-context'
import type { Item } from '@/lib/domain/types'
import { isHttpUrl } from '@/lib/content/url'
import { resourceLabel } from '@/lib/content/resource-label'
import { ArrowRightIcon, FileIcon, LinkIcon } from './icons'
import { withPreview } from '@/lib/membros/paths'

export function ResourceList({ items, storeSlug, currentItemId, legacyPresentation = false, preview = false }: { items: Item[]; storeSlug: string; currentItemId?: string; legacyPresentation?: boolean; preview?: PreviewContext }) {
  const resources = items.filter((item) => (previewIncludesDrafts(preview) || item.isPublished) && item.kind !== 'video' && isHttpUrl(item.url))
  if (resources.length === 0) return null
  const ordered = currentItemId
    ? [...resources.filter((item) => item.id === currentItemId), ...resources.filter((item) => item.id !== currentItemId)]
    : resources

  return (
    <ul className="space-y-3">
      {ordered.map((item) => {
        const isLink = item.kind === 'link'
        const Icon = isLink ? LinkIcon : FileIcon
        const { actionLabel, typeLabel } = resourceLabel(item)
        const action = legacyPresentation ? (isLink ? 'Abrir link' : 'Baixar') : actionLabel
        return (
          <li key={item.id} className="min-w-0">
            <a
              href={withPreview(`/${storeSlug}/item/${item.id}/abrir`, preview)}
              target={isLink ? '_blank' : undefined}
              rel={isLink ? 'noopener noreferrer' : undefined}
              aria-label={`${action}${legacyPresentation ? ' ' : ': '}${item.title}${isLink ? ' (abre em nova aba)' : ''}`}
              className={`group grid min-h-20 min-w-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-x-4 gap-y-2 rounded-xl border border-borda px-4 py-4 transition-colors hover:border-destaque/70 hover:bg-superficie-2 focus-visible:border-destaque focus-visible:bg-superficie-2 sm:flex sm:gap-4 sm:px-5 ${item.id === currentItemId ? 'bg-superficie-2' : 'bg-superficie'}`}
            >
              <span className="row-span-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-borda bg-fundo text-destaque" aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              <span className="col-start-2 min-w-0 flex-1">
                <span className="block break-words [overflow-wrap:anywhere] text-sm font-semibold leading-snug text-texto sm:text-base">{item.title}</span>
                <span className="mt-1 block text-xs text-texto-suave">{isLink ? 'Link externo · abre em nova aba' : legacyPresentation ? 'Arquivo' : typeLabel}</span>
              </span>
              {!legacyPresentation && <span className="col-start-2 row-start-2 shrink-0 text-xs font-semibold text-destaque sm:text-sm" aria-hidden>{actionLabel}</span>}
              <span className="lesson-resource-action col-start-3 row-span-2 row-start-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-destaque text-white motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus-visible:-translate-y-0.5" aria-hidden>
                <ArrowRightIcon className="h-5 w-5" />
              </span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
