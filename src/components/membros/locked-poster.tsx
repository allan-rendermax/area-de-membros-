'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ShelfProduct } from '@/lib/access/access'
import { isHttpUrl } from '@/lib/content/url'
import { ContentImage } from './content-image'
import { useMemberTheme } from './member-theme'
import { AutoCover } from './auto-cover'
import { LockIcon } from './icons'
import { Modal } from './modal'
import { POSTER_WIDTH } from './poster-card'

export function LockedPoster({ product, initiallyOpen = false, previewOnly = false }: { product: ShelfProduct; initiallyOpen?: boolean; previewOnly?: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(initiallyOpen)
  const theme = useMemberTheme()
  const trigger = useRef<HTMLButtonElement>(null)
  const primaryAction = useRef<HTMLButtonElement | HTMLAnchorElement>(null)
  const studentCheckoutUrl = product.studentCheckoutUrl && isHttpUrl(product.studentCheckoutUrl) ? product.studentCheckoutUrl : null
  const checkoutUrl = product.checkoutUrl && isHttpUrl(product.checkoutUrl) ? product.checkoutUrl : null
  const imageUrl = product.purchaseImageUrl && isHttpUrl(product.purchaseImageUrl) ? product.purchaseImageUrl : null
  const destination = studentCheckoutUrl || checkoutUrl
  const requestedSlug = searchParams.get('comprar')
  const [previousRequestedSlug, setPreviousRequestedSlug] = useState(requestedSlug)

  if (requestedSlug !== previousRequestedSlug) {
    setPreviousRequestedSlug(requestedSlug)
    setOpen(requestedSlug === product.slug)
  }

  useLayoutEffect(() => {
    if (open) trigger.current?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (open) primaryAction.current?.focus({ preventScroll: true })
  }, [open])

  const close = useCallback(() => {
    setOpen(false)
    if (!searchParams.has('comprar')) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('comprar')
    const query = params.toString()
    window.history.replaceState(null, '', `${pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  }, [pathname, searchParams])

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true })
          setOpen(true)
        }}
        aria-label={previewOnly ? 'Visualizar modal de produto bloqueado' : `${product.title} — bloqueado, ver detalhes`}
        aria-haspopup="dialog"
        className={previewOnly ? 'min-h-11 rounded-full border border-borda px-5 py-3 text-sm font-semibold hover:bg-superficie-2' : `member-poster ${POSTER_WIDTH} group block text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-destaque motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:scale-[1.04]`}
      >
        {previewOnly ? 'Visualizar modal de produto bloqueado' : <>
        <div className="relative">
          <AutoCover seed={product.id} title={product.title} imageUrl={product.coverUrl} aspect="poster" className="grayscale opacity-70" />
          <span className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-fundo/85 text-texto shadow-md">
            <LockIcon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-texto-suave">{product.title}</p>
        </>}
      </button>

      <Modal open={open} onClose={close} labelledBy={`comprar-${product.id}`} className="relative max-w-lg border border-borda p-6 sm:p-8" backdropClassName="bg-black/70 backdrop-blur-sm">
        <p className="mb-3 text-xs font-bold uppercase tracking-[.14em] text-destaque">Disponível para você</p>
        <h2 id={`comprar-${product.id}`} className="pr-10 text-2xl leading-tight font-bold break-words">{product.purchaseTitle?.trim() || product.title}</h2>
        {imageUrl && <div className="relative mt-5 aspect-square overflow-hidden rounded-xl bg-fundo"><ContentImage src={imageUrl} sizes="(max-width: 512px) 90vw, 448px" className="h-full w-full object-contain" /></div>}
        {(product.purchaseDescription || product.description) && <p className="mt-5 break-words text-base leading-relaxed whitespace-pre-line text-texto-suave">{product.purchaseDescription || product.description}</p>}
        {studentCheckoutUrl && <p className="mt-4 text-sm font-semibold text-destaque">Seu desconto de aluno já está aplicado no checkout.</p>}
        {destination ? <a ref={primaryAction as React.Ref<HTMLAnchorElement>} href={previewOnly ? undefined : destination} role={previewOnly ? 'button' : undefined} tabIndex={previewOnly ? 0 : undefined} aria-disabled={previewOnly || undefined} onClick={previewOnly ? event => event.preventDefault() : undefined} target={previewOnly ? undefined : '_blank'} rel="noopener noreferrer"
          className={`mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-destaque px-6 py-3.5 text-center font-bold shadow-md hover:bg-destaque-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-destaque motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:scale-[1.03] ${theme === 'arquitetura' ? 'text-fundo' : 'text-white'}`}>
          {product.purchaseButtonText?.trim() || 'Quero acessar'}<span aria-hidden="true">→</span>
        </a> : <p className="mt-7 text-sm text-texto-suave">Este material ainda não está disponível para compra.</p>}
        <button type="button" onClick={close} className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-borda text-texto-suave hover:bg-superficie-2 hover:text-texto focus-visible:outline-2 focus-visible:outline-destaque">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" /></svg><span className="sr-only">Fechar</span>
        </button>
      </Modal>
    </>
  )
}
