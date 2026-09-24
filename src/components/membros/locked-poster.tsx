'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ShelfProduct } from '@/lib/access/access'
import { isHttpUrl } from '@/lib/content/url'
import { AutoCover } from './auto-cover'
import { LockIcon } from './icons'
import { Modal } from './modal'
import { POSTER_WIDTH } from './poster-card'

export function LockedPoster({ product, initiallyOpen = false }: { product: ShelfProduct; initiallyOpen?: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(initiallyOpen)
  const [stage, setStage] = useState<'details' | 'coupon'>('details')
  const primaryAction = useRef<HTMLButtonElement | HTMLAnchorElement>(null)
  const studentCheckoutUrl = product.studentCheckoutUrl && isHttpUrl(product.studentCheckoutUrl) ? product.studentCheckoutUrl : null
  const checkoutUrl = product.checkoutUrl && isHttpUrl(product.checkoutUrl) ? product.checkoutUrl : null
  const requestedSlug = searchParams.get('comprar')
  const [previousRequestedSlug, setPreviousRequestedSlug] = useState(requestedSlug)

  if (requestedSlug !== previousRequestedSlug) {
    setPreviousRequestedSlug(requestedSlug)
    setOpen(requestedSlug === product.slug)
    setStage('details')
  }

  useEffect(() => {
    if (open) primaryAction.current?.focus({ preventScroll: true })
  }, [open, stage])

  const close = useCallback(() => {
    setOpen(false)
    setStage('details')
    if (!searchParams.has('comprar')) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('comprar')
    const query = params.toString()
    window.history.replaceState(null, '', `${pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  }, [pathname, searchParams])

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true })
          setStage('details')
          setOpen(true)
        }}
        aria-label={`${product.title} — bloqueado, ver detalhes`}
        className={`member-poster ${POSTER_WIDTH} group block text-left transition-transform duration-200 hover:scale-[1.04]`}
      >
        <div className="relative">
          <AutoCover seed={product.id} title={product.title} imageUrl={product.coverUrl} aspect="poster" muted />
          <span className="absolute top-2 right-2 rounded-full bg-fundo/85 p-1.5 text-texto">
            <LockIcon />
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-texto-suave">{product.title}</p>
      </button>

      <Modal open={open} onClose={close} labelledBy={`comprar-${product.id}`}>
        {stage === 'details' && <AutoCover seed={product.id} title="" imageUrl={product.bannerUrl ?? product.coverUrl} aspect="banner" className="rounded-none" />}
        <div className="p-6">
          <h2 id={`comprar-${product.id}`} className="text-2xl leading-tight font-bold">{stage === 'coupon' ? 'Seu desconto de aluno' : product.title}</h2>
          {stage === 'coupon' ? (
            <>
              <p className="mt-3 font-semibold">{product.title}</p>
              <p className="mt-2 text-texto-suave">Você tem 10% de desconto neste material.</p>
            </>
          ) : (product.description && <p className="mt-3 leading-relaxed whitespace-pre-line text-texto-suave">{product.description}</p>)}
          <div className="mt-6 flex flex-col gap-2">
            {stage === 'coupon' && studentCheckoutUrl && (
              <a
                ref={primaryAction as React.Ref<HTMLAnchorElement>}
                href={studentCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-destaque px-4 py-3 text-center font-semibold text-texto hover:bg-destaque-hover"
              >
                Ir para o checkout com 10% de desconto
              </a>
            )}
            {stage === 'coupon' && <button type="button" onClick={() => setStage('details')} className="rounded-md px-4 py-3 text-texto-suave hover:text-texto">Voltar</button>}
            {stage === 'details' && studentCheckoutUrl && (
              <button ref={primaryAction as React.Ref<HTMLButtonElement>} type="button" onClick={() => setStage('coupon')}
                className="rounded-md bg-destaque px-4 py-3 text-center font-semibold text-texto hover:bg-destaque-hover">
                Resgatar meu cupom de 10%
              </button>
            )}
            {stage === 'details' && !studentCheckoutUrl && checkoutUrl && (
              <a ref={primaryAction as React.Ref<HTMLAnchorElement>} href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                className="rounded-md bg-destaque px-4 py-3 text-center font-semibold text-texto hover:bg-destaque-hover">Quero acessar</a>
            )}
            {stage === 'details' && !studentCheckoutUrl && !checkoutUrl && (
              <p className="text-texto-suave">Este material ainda não está disponível para compra.</p>
            )}
            <button type="button" onClick={close} className="rounded-md px-4 py-3 text-texto-suave hover:text-texto">
              Fechar
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
