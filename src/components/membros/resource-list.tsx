import type { Item } from '@/lib/domain/types'
import { isHttpUrl } from '@/lib/content/url'
import { DownloadIcon, FileIcon, LinkIcon } from './icons'

export function ResourceList({ items, storeSlug, currentItemId }: { items: Item[]; storeSlug: string; currentItemId?: string }) {
  const resources = items.filter((item) => item.isPublished && item.kind !== 'video' && isHttpUrl(item.url))
  if (resources.length === 0) return null
  const ordered = currentItemId
    ? [...resources.filter((item) => item.id === currentItemId), ...resources.filter((item) => item.id !== currentItemId)]
    : resources

  return (
    <ul className="divide-y divide-borda overflow-hidden rounded-lg border border-borda bg-superficie">
      {ordered.map((item) => {
        const isLink = item.kind === 'link'
        const Icon = isLink ? LinkIcon : FileIcon
        const action = isLink ? 'Abrir link' : 'Baixar'
        return (
          <li key={item.id} className={item.id === currentItemId ? 'bg-superficie-2/70' : ''}>
            <a
              href={`/${storeSlug}/item/${item.id}/abrir`}
              target={isLink ? '_blank' : undefined}
              rel={isLink ? 'noopener noreferrer' : undefined}
              aria-label={`${action} ${item.title}${isLink ? ' (abre em nova aba)' : ''}`}
              className="group flex min-h-18 min-w-0 items-center gap-3 px-4 py-4 hover:bg-superficie-2 focus-visible:bg-superficie-2 sm:gap-4 sm:px-5"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-borda bg-fundo text-texto-suave" aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-semibold leading-snug text-texto sm:text-base">{item.title}</span>
                <span className="mt-1 block text-xs text-texto-suave">{isLink ? 'Link externo · abre em nova aba' : 'Arquivo'}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-texto sm:text-sm" aria-hidden>
                <span>{action}</span>
                {isLink ? <span className="text-base leading-none text-destaque">↗</span> : <DownloadIcon className="h-4 w-4 text-destaque motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-y-0.5 motion-safe:group-focus-visible:translate-y-0.5" />}
              </span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
