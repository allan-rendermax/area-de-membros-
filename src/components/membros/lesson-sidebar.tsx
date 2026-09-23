import type { ModuleWithItems } from '@/lib/domain/types'
import { isHttpUrl } from '@/lib/content/url'
import { toVideoEmbed } from '@/lib/content/video'
import { ItemAnchor } from './episode-card'
import { FileIcon, LinkIcon, PlayIcon } from './icons'

function usable(item: ModuleWithItems['items'][number]) {
  return item.isPublished && (item.kind === 'video' ? Boolean(toVideoEmbed(item.url)) : isHttpUrl(item.url))
}

export function LessonSidebar({ modules, storeSlug, currentItemId }: {
  modules: ModuleWithItems[]
  storeSlug: string
  currentItemId?: string
}) {
  const visible = modules.filter((module) => module.isPublished).map((module) => ({ ...module, items: module.items.filter(usable) })).filter((module) => module.items.length > 0)
  if (visible.length === 0) return null

  return (
    <aside className="lesson-sidebar min-w-0 self-start" aria-label="Conteúdos do produto">
      <div className="lesson-sidebar-panel rounded-2xl border border-borda bg-superficie p-5 sm:p-6">
        <h2 className="lesson-sidebar-heading break-words text-2xl font-bold">Conteúdos</h2>
        <div className="mt-5 space-y-3">
          {visible.map((module) => (
            <details key={module.id} open={currentItemId ? module.items.some((item) => item.id === currentItemId) : true} className="lesson-module group min-w-0 rounded-xl border border-borda bg-fundo/50">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] font-semibold leading-snug">{module.title}</span>
                <span className="shrink-0 text-xs text-texto-suave">{module.items.length}</span>
                <span aria-hidden className="lesson-chevron shrink-0 text-destaque motion-safe:transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <ol className="border-t border-borda px-2 py-2">
                {module.items.map((item) => {
                  const Icon = item.kind === 'video' ? PlayIcon : item.kind === 'link' ? LinkIcon : FileIcon
                  return <li key={item.id} className="min-w-0">
                    <ItemAnchor item={item} storeSlug={storeSlug} current={item.id === currentItemId} className={`lesson-sidebar-link flex min-w-0 items-start gap-3 rounded-lg px-3 py-3 text-sm leading-snug ${item.id === currentItemId ? 'bg-superficie-2 text-texto' : 'text-texto-suave hover:bg-superficie-2 hover:text-texto'}`}>
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-destaque" />
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{item.title}</span>
                    </ItemAnchor>
                  </li>
                })}
              </ol>
            </details>
          ))}
        </div>
      </div>
    </aside>
  )
}
