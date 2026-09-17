'use client'

import { useEffect, useRef, useState } from 'react'
import type { ShelfProduct } from '@/lib/access/access'
import { AutoCover } from './auto-cover'
import { LockIcon } from './icons'
import { POSTER_WIDTH } from './poster-card'

export function LockedPoster({ product, initiallyOpen = false }: { product: ShelfProduct; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${product.title} — bloqueado, ver detalhes`}
        className={`${POSTER_WIDTH} group block text-left transition-transform duration-200 hover:scale-[1.04]`}
      >
        <div className="relative">
          <AutoCover seed={product.id} title={product.title} imageUrl={product.coverUrl} aspect="poster" muted />
          <span className="absolute top-2 right-2 rounded-full bg-fundo/85 p-1.5 text-texto">
            <LockIcon />
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-texto-suave">{product.title}</p>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`comprar-${product.id}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div className="painel-sobe w-full max-w-lg overflow-hidden rounded-t-xl bg-superficie sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <AutoCover seed={product.id} title="" imageUrl={product.bannerUrl ?? product.coverUrl} aspect="banner" className="rounded-none" />
            <div className="p-6">
              <h2 id={`comprar-${product.id}`} className="text-2xl leading-tight font-bold">{product.title}</h2>
              {product.description && <p className="mt-3 leading-relaxed whitespace-pre-line text-texto-suave">{product.description}</p>}
              <div className="mt-6 flex flex-col gap-2">
                {product.checkoutUrl && (
                  <a
                    href={product.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-destaque px-4 py-3 text-center font-semibold text-white hover:bg-destaque-hover"
                  >
                    Quero acessar
                  </a>
                )}
                <button ref={closeButton} type="button" onClick={() => setOpen(false)} className="rounded-md px-4 py-3 text-texto-suave hover:text-texto">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
