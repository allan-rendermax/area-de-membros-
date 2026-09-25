'use client'

import { useId, useState } from 'react'
import { isHttpUrl } from '@/lib/content/url'
import type { AccessLevel } from '@/lib/domain/types'
import { Modal } from './modal'
import { ContentImage } from './content-image'

export function ProductUpgrade({ level, lockedCount, checkoutUrl, refreshHref, productTitle = 'Versão completa', imageUrl, buttonText, sectionName = 'Completo', supportUrl }: {
  level: AccessLevel
  lockedCount: number
  checkoutUrl?: string | null
  refreshHref: string
  productTitle?: string
  imageUrl?: string | null
  buttonText?: string | null
  sectionName?: string
  supportUrl?: string | null
}) {
  const [open, setOpen] = useState(false)
  const headingId = useId()
  if (level !== 'basic' || lockedCount === 0) return null
  const checkout = checkoutUrl && isHttpUrl(checkoutUrl) ? checkoutUrl : null
  const image = imageUrl && isHttpUrl(imageUrl) ? imageUrl : null
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
      className="mt-3 flex min-h-16 w-full items-center gap-3 rounded-xl border border-borda bg-fundo/50 px-4 py-4 text-left hover:border-destaque focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-destaque motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:scale-[1.02]">
      <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{sectionName}</span><span className="mt-1 block text-xs text-destaque">Conheça a versão completa</span></span>
      <span aria-hidden="true" className="text-xl text-destaque">↗</span>
    </button>
    <Modal open={open} onClose={() => setOpen(false)} labelledBy={headingId} className="max-w-md border border-borda p-5 sm:p-6" backdropClassName="bg-black/70 backdrop-blur-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-destaque">Versão completa</p><h2 id={headingId} className="mt-1 break-words text-xl font-bold leading-snug">{productTitle}</h2></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-borda text-xl hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-destaque">×</button>
      </div>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-fundo p-4">
        {image ? <ContentImage src={image} sizes="(max-width: 480px) 90vw, 400px" className="h-full w-full object-contain" /> : <div className="p-6 text-center"><span className="text-xs font-bold uppercase tracking-widest text-destaque">Completo</span><p className="mt-4 text-2xl font-bold">{productTitle}</p></div>}
      </div>
      {checkout ? <a href={checkout} target="_blank" rel="noopener noreferrer" className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-destaque px-5 py-3 text-center text-sm font-bold text-fundo focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-destaque motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:scale-[1.03]">
        {buttonText?.trim() || 'Quero a versão completa'} <span aria-hidden="true">↗</span>
      </a> : <p className="mt-5 text-center text-sm text-texto-suave">Para liberar a versão completa, {supportUrl && isHttpUrl(supportUrl) ? <a href={supportUrl} className="font-semibold text-destaque underline">fale com o suporte</a> : 'entre em contato com o suporte'}.</p>}
      <p className="mt-4 text-center"><a href={refreshHref} className="text-xs text-texto-suave underline underline-offset-4">Já paguei, atualizar acesso</a></p>
    </Modal>
  </>
}
