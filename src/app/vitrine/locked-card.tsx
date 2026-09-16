'use client'

import { useState } from 'react'
import type { VitrineItem } from '@/lib/access/access'
import { Cover } from './cover'

type LockedItem = Extract<VitrineItem, { unlocked: false }>

export function LockedCard({ item }: { item: LockedItem }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${item.title} — bloqueado, ver detalhes`}
        className="flex w-full flex-col gap-3 text-left"
      >
        <div className="relative overflow-hidden rounded-[3px]">
          <Cover title={item.title} coverUrl={item.coverUrl} muted />
          <div className="absolute inset-x-[-15%] top-[30%] -translate-y-1/2 -rotate-[8deg]" aria-hidden>
            <div className="fita-interdicao h-2" />
            <div className="bg-sinal py-1.5 text-center text-[0.8rem] font-bold text-tinta [font-stretch:80%]">
              Acesso bloqueado
            </div>
            <div className="fita-interdicao h-2" />
          </div>
        </div>
        <h3 className="text-[0.95rem] leading-snug font-semibold text-grafite">{item.title}</h3>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`locked-${item.id}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/60 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="painel-sobe w-full max-w-md rounded-t-xl bg-papel p-6 pb-8 sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fita-interdicao -mx-6 -mt-6 mb-5 h-2 rounded-t-xl" aria-hidden />
            <h2 id={`locked-${item.id}`} className="text-2xl leading-tight font-bold [font-stretch:78%]">
              {item.title}
            </h2>
            {item.description && (
              <p className="mt-3 max-w-prose leading-relaxed whitespace-pre-line text-grafite">{item.description}</p>
            )}
            <div className="mt-6 flex flex-col gap-2">
              {item.checkoutUrl && (
                <a
                  href={item.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-tinta px-4 py-3.5 text-center font-semibold text-papel hover:bg-tinta-suave"
                >
                  Quero acessar
                </a>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-4 py-3 text-grafite hover:text-tinta"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
