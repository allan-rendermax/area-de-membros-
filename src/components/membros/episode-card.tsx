import Link from 'next/link'
import type { Item } from '@/lib/domain/types'
import { AutoCover } from './auto-cover'
import { FileIcon, LinkIcon, PlayIcon } from './icons'

export const EPISODE_WIDTH = 'w-[75%] shrink-0 snap-start sm:w-[40%] lg:w-[24%]'

const LABEL = { arquivo: 'Arquivo', video: 'Vídeo', link: 'Link' } as const
const ICON = { arquivo: FileIcon, video: PlayIcon, link: LinkIcon } as const

export function ItemAnchor({
  item,
  storeSlug,
  className,
  children,
  current = false,
}: {
  item: Pick<Item, 'id' | 'kind'>
  storeSlug: string
  className: string
  children: React.ReactNode
  current?: boolean
}) {
  const href = `/${storeSlug}/item/${item.id}`
  if (item.kind === 'video') {
    return (
      <Link href={href} prefetch={false} className={className} aria-current={current ? 'page' : undefined}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}

export function EpisodeCard({ item, storeSlug, className = '' }: { item: Item; storeSlug: string; className?: string }) {
  const Icon = ICON[item.kind]
  return (
    <ItemAnchor item={item} storeSlug={storeSlug} className={`group block transition-transform duration-200 hover:scale-[1.03] ${className}`}>
      <div className="relative">
        <AutoCover seed={item.id} title={item.title} imageUrl={item.coverUrl} aspect="episode" />
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-fundo/85 px-2 py-1 text-xs text-texto">
          <Icon className="h-3.5 w-3.5" />
          {LABEL[item.kind]}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-texto-suave group-hover:text-texto">{item.title}</p>
    </ItemAnchor>
  )
}
