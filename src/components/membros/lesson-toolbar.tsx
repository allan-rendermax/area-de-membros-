'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveCompletion } from '@/app/[loja]/progresso/actions'
import { useEffect, useId, useRef, useState, useTransition } from 'react'

type LessonLink = { href: string; title: string }

export type LessonToolbarProps = {
  storeSlug: string
  initialCompleted: boolean
  progressAvailable?: boolean
  preview?: boolean
  productTitle: string
  moduleTitle: string
  itemId: string
  itemTitle: string
  description?: string
  previous: LessonLink | null
  next: LessonLink | null
}

const navigationClass = 'inline-flex min-h-11 min-w-0 basis-[calc(50%-0.5rem)] flex-1 items-center justify-center gap-2 rounded-full border border-borda bg-superficie-2 px-4 py-2 text-center text-sm font-medium text-texto hover:bg-borda focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-45 sm:basis-auto sm:flex-none'

function ToolbarIcon({ kind }: { kind: 'info' | 'previous' | 'next' | 'check' }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
    {kind === 'info' && <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>}
    {kind === 'previous' && <path d="m14 6-6 6 6 6" />}
    {kind === 'next' && <path d="m10 6 6 6-6 6" />}
    {kind === 'check' && <path d="m5 12 4 4L19 6" />}
  </svg>
}

export function LessonToolbar({ storeSlug, initialCompleted, progressAvailable = true, preview = false, productTitle, moduleTitle, itemId, itemTitle, description, previous, next }: LessonToolbarProps) {
  const router = useRouter()
  const [saved, setSaved] = useState<{ itemId: string; completed: boolean } | null>(null)
  const complete = saved?.itemId === itemId ? saved.completed : initialCompleted
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const saving = useRef(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

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
    if (preview || saving.current || !progressAvailable) return
    saving.current = true
    setError('')
    startTransition(async () => {
      try {
        const result = await saveCompletion(storeSlug, itemId, !complete)
        if (result.ok) {
          setSaved({ itemId, completed: result.completed })
          router.refresh()
        } else setError(result.error)
      } catch {
        setError('Não foi possível salvar o progresso. Tente novamente.')
      } finally { saving.current = false }
    })
  }

  return (
    <div ref={wrapperRef} className="relative sm:sticky sm:bottom-4 z-20 mt-8 min-w-0 rounded-2xl border border-borda bg-superficie/95 px-3 py-3 text-texto shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:px-5">
      {aboutOpen && (
        <section id={panelId} aria-label="Sobre este conteúdo" className="absolute bottom-full left-3 right-3 mb-2 max-h-[min(65dvh,24rem)] overflow-y-auto rounded-xl border border-borda bg-superficie p-5 shadow-2xl sm:left-5 sm:right-auto sm:w-[min(25rem,calc(100vw-2.5rem))]">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">Sobre este conteúdo</h2>
            <button type="button" onClick={closeAbout} className="rounded-md px-2 py-1 text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto">Fechar informações</button>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-xs font-medium uppercase tracking-wide text-texto-suave">Produto</dt><dd className="mt-1 break-words font-medium">{productTitle}</dd></div>
            <div><dt className="text-xs font-medium uppercase tracking-wide text-texto-suave">Módulo</dt><dd className="mt-1 break-words font-medium">{moduleTitle}</dd></div>
            <div><dt className="text-xs font-medium uppercase tracking-wide text-texto-suave">Conteúdo</dt><dd className="mt-1 break-words font-medium">{itemTitle}</dd></div>
          </dl>
          {description && <p className="mt-4 border-t border-borda pt-4 text-sm leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] text-texto-suave"><strong className="block text-texto">Sobre o produto</strong>{description}</p>}
        </section>
      )}
      <div className="mx-auto flex max-w-6xl min-w-0 flex-wrap items-center gap-2">
        <button ref={triggerRef} type="button" aria-expanded={aboutOpen} aria-controls={panelId} onClick={() => setAboutOpen((open) => !open)} className={`${navigationClass} order-1`}><ToolbarIcon kind="info" />Sobre</button>
        {previous ? <Link href={previous.href} title={previous.title} className={`${navigationClass} order-2`}><ToolbarIcon kind="previous" />Conteúdo anterior</Link> : <button type="button" disabled className={`${navigationClass} order-2`}><ToolbarIcon kind="previous" />Conteúdo anterior</button>}
        {next ? <Link href={next.href} title={next.title} className={`${navigationClass} order-3`}>Próximo conteúdo<ToolbarIcon kind="next" /></Link> : <button type="button" disabled className={`${navigationClass} order-3`}>Próximo conteúdo<ToolbarIcon kind="next" /></button>}
        <div className="order-4 flex min-w-0 w-full flex-col items-stretch sm:ml-auto sm:w-auto sm:items-end">
          <button type="button" disabled={preview || pending || !progressAvailable} aria-pressed={Boolean(complete)} onClick={toggleCompletion} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50 ${complete ? 'border border-destaque bg-destaque/15 text-texto hover:bg-destaque/25' : 'bg-destaque text-white hover:bg-destaque/80'}`}><ToolbarIcon kind="check" />{pending ? 'Salvando…' : complete ? 'Concluído' : 'Concluir'}</button>
          {preview && <span className="mt-1 text-center text-[11px] leading-tight text-texto-suave">Progresso desativado na prévia</span>}
          {!error && saved?.itemId === itemId && <span className="mt-1 text-center text-[11px] leading-tight text-texto-suave">Progresso salvo na sua conta</span>}
        </div>
      </div>
      {error && <p role="alert" className="mx-auto mt-2 max-w-6xl text-xs text-alerta">{error}</p>}
    </div>
  )
}
