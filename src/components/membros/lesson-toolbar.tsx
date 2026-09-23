'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

type LessonLink = { href: string; title: string }

export type LessonToolbarProps = {
  storeId: string
  customerId: string
  productTitle: string
  moduleTitle: string
  itemId: string
  itemTitle: string
  description?: string
  previous: LessonLink | null
  next: LessonLink | null
}

const navigationClass = 'inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-borda bg-superficie-2 px-4 py-2 text-center text-sm font-medium text-texto hover:bg-borda focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none'
const completionEvent = 'member-lesson-completion-change'

function ToolbarIcon({ kind }: { kind: 'info' | 'previous' | 'next' | 'check' }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
    {kind === 'info' && <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>}
    {kind === 'previous' && <path d="m14 6-6 6 6 6" />}
    {kind === 'next' && <path d="m10 6 6 6-6 6" />}
    {kind === 'check' && <path d="m5 12 4 4L19 6" />}
  </svg>
}

function subscribeToCompletion(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(completionEvent, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(completionEvent, onChange)
  }
}

export function LessonToolbar({ storeId, customerId, productTitle, moduleTitle, itemId, itemTitle, description, previous, next }: LessonToolbarProps) {
  const storageKey = `lesson-complete:${JSON.stringify([storeId, customerId, itemId])}`
  const [writeError, setWriteError] = useState<{ key: string; message: string } | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const stored = useSyncExternalStore(subscribeToCompletion, () => {
    try { return window.localStorage.getItem(storageKey) === 'true' ? 'complete' : 'incomplete' }
    catch { return 'unavailable' }
  }, () => 'incomplete')
  const complete = stored === 'complete'
  const error = writeError?.key === storageKey ? writeError.message : stored === 'unavailable' ? 'Não foi possível acessar o progresso salvo neste navegador.' : ''

  useEffect(() => {
    if (!aboutOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAboutOpen(false)
        triggerRef.current?.focus()
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setAboutOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [aboutOpen])

  function closeAbout() {
    setAboutOpen(false)
    triggerRef.current?.focus()
  }

  function toggleCompletion() {
    const nextComplete = !complete
    try {
      if (nextComplete) window.localStorage.setItem(storageKey, 'true')
      else window.localStorage.removeItem(storageKey)
      setWriteError(null)
      window.dispatchEvent(new Event(completionEvent))
    } catch {
      setWriteError({ key: storageKey, message: 'Não foi possível salvar o progresso neste navegador. Tente novamente.' })
    }
  }

  return (
    <div ref={wrapperRef} className="sticky bottom-4 z-20 mt-8 min-w-0 rounded-2xl border border-borda bg-superficie/95 px-3 py-3 text-texto shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:px-5">
      {aboutOpen && (
        <section id={panelId} aria-label="Sobre esta aula" className="absolute bottom-full left-3 right-3 mb-2 max-h-[min(65dvh,24rem)] overflow-y-auto rounded-xl border border-borda bg-superficie p-5 shadow-2xl sm:left-5 sm:right-auto sm:w-[min(25rem,calc(100vw-2.5rem))]">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">Sobre esta aula</h2>
            <button type="button" onClick={closeAbout} className="rounded-md px-2 py-1 text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto">Fechar informações</button>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-xs font-medium uppercase tracking-wide text-texto-suave">Produto</dt><dd className="mt-1 break-words font-medium">{productTitle}</dd></div>
            <div><dt className="text-xs font-medium uppercase tracking-wide text-texto-suave">Módulo</dt><dd className="mt-1 break-words font-medium">{moduleTitle}</dd></div>
            <div><dt className="text-xs font-medium uppercase tracking-wide text-texto-suave">Aula</dt><dd className="mt-1 break-words font-medium">{itemTitle}</dd></div>
          </dl>
          {description && <p className="mt-4 border-t border-borda pt-4 text-sm leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] text-texto-suave">{description}</p>}
        </section>
      )}
      <div className="mx-auto flex max-w-6xl min-w-0 flex-wrap items-center gap-2">
        <button ref={triggerRef} type="button" aria-expanded={aboutOpen} aria-controls={panelId} onClick={() => setAboutOpen((open) => !open)} className={`${navigationClass} order-1`}><ToolbarIcon kind="info" />Sobre</button>
        {previous ? <Link href={previous.href} title={previous.title} className={`${navigationClass} order-2`}><ToolbarIcon kind="previous" />Aula anterior</Link> : <button type="button" disabled className={`${navigationClass} order-2`}><ToolbarIcon kind="previous" />Aula anterior</button>}
        {next ? <Link href={next.href} title={next.title} className={`${navigationClass} order-3`}>Próxima aula<ToolbarIcon kind="next" /></Link> : <button type="button" disabled className={`${navigationClass} order-3`}>Próxima aula<ToolbarIcon kind="next" /></button>}
        <div className="order-4 flex min-w-0 w-full flex-col items-stretch sm:ml-auto sm:w-auto sm:items-end">
          <button type="button" aria-pressed={Boolean(complete)} onClick={toggleCompletion} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold focus-visible:outline-2 ${complete ? 'border border-destaque bg-destaque/15 text-texto hover:bg-destaque/25' : 'bg-destaque text-white hover:bg-destaque/80'}`}><ToolbarIcon kind="check" />{complete ? 'Concluído' : 'Concluir'}</button>
          {!error && <span className="mt-1 text-center text-[11px] leading-tight text-texto-suave">Salvo neste navegador</span>}
        </div>
      </div>
      {error && <p role="alert" className="mx-auto mt-2 max-w-6xl text-xs text-alerta">{error}</p>}
    </div>
  )
}
