'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import type { ModuleWithItems } from '@/lib/domain/types'
import { isHttpUrl } from '@/lib/content/url'
import { toVideoEmbed } from '@/lib/content/video'
import { ItemAnchor } from './episode-card'
import { FileIcon, LinkIcon, PlayIcon } from './icons'

function usable(item: ModuleWithItems['items'][number], preview: boolean) {
  return (preview || item.isPublished) && (item.kind === 'video' ? Boolean(toVideoEmbed(item.url)) : isHttpUrl(item.url))
}

const desktopQuery = '(min-width: 1024px)'
function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia(desktopQuery)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
function isDesktop() { return window.matchMedia(desktopQuery).matches }
function serverViewport() { return false }

export function LessonSidebar({ modules, storeSlug, currentItemId, completedItemIds = [], legacyPresentation = false, preview = false, upgrade }: {
  upgrade?: ReactNode
  modules: ModuleWithItems[]
  storeSlug: string
  currentItemId?: string
  completedItemIds?: string[]
  legacyPresentation?: boolean
  preview?: boolean
}) {
  const desktop = useSyncExternalStore(subscribeToViewport, isDesktop, serverViewport)
  const visible = modules.filter((module) => preview || module.isPublished).map((module) => ({ ...module, items: module.items.filter((item) => usable(item, preview)) })).filter((module) => module.items.length > 0)
  if (visible.length === 0) return null

  const content = (
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
                <ItemAnchor item={item} storeSlug={storeSlug} preview={preview} current={item.id === currentItemId} className={`lesson-sidebar-link flex min-w-0 items-start gap-3 rounded-lg px-3 py-3 text-sm leading-snug ${item.id === currentItemId ? 'bg-superficie-2 text-texto' : 'text-texto-suave hover:bg-superficie-2 hover:text-texto'}`}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-destaque" />
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">{item.title}{!legacyPresentation && item.id === currentItemId && <span className="mt-1 block text-xs text-destaque">Conteúdo atual</span>}{!legacyPresentation && completedItemIds.includes(item.id) && <span className="mt-1 block text-xs text-texto">Concluído</span>}</span>
                </ItemAnchor>
              </li>
            })}
          </ol>
        </details>
      ))}
      {upgrade}
    </div>
  )

  return (
    <aside className={`lesson-sidebar min-w-0 self-start ${legacyPresentation ? '' : 'order-1 lg:order-2'}`} aria-label="Conteúdos do produto">
      {legacyPresentation ? (
        <div className="lesson-sidebar-panel rounded-2xl border border-borda bg-superficie p-5 sm:p-6">
          <h2 className="lesson-sidebar-heading break-words text-2xl font-bold">Conteúdos</h2>
          {content}
        </div>
      ) : (
        <details open={desktop || undefined} className="lesson-contents lesson-sidebar-panel rounded-2xl border border-borda bg-superficie p-5 sm:p-6">
          <summary tabIndex={desktop ? -1 : undefined} onClick={(event) => { if (desktop) event.preventDefault() }} className="lesson-sidebar-heading min-h-11 cursor-pointer break-words text-2xl font-bold">Conteúdos</summary>
          {content}
        </details>
      )}
    </aside>
  )
}
