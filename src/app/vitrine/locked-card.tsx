'use client'

import { useState } from 'react'
import type { VitrineItem } from '@/lib/access/access'

type LockedItem = Extract<VitrineItem, { unlocked: false }>

export function LockedCard({ item }: { item: LockedItem }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left"
      >
        <div className="relative aspect-[3/4] bg-zinc-100">
          {item.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.coverUrl} alt="" className="h-full w-full object-cover opacity-40 grayscale" />
          )}
          <span className="absolute inset-0 flex items-center justify-center text-3xl" aria-hidden>🔒</span>
        </div>
        <div className="p-3">
          <h3 className="text-sm font-semibold text-zinc-500">{item.title}</h3>
        </div>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`locked-${item.id}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={`locked-${item.id}`} className="text-xl font-bold">{item.title}</h2>
            {item.description && <p className="mt-3 whitespace-pre-line text-zinc-600">{item.description}</p>}
            <div className="mt-6 flex flex-col gap-2">
              {item.checkoutUrl && (
                <a
                  href={item.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-zinc-900 px-4 py-3 text-center font-semibold text-white"
                >
                  Quero acessar
                </a>
              )}
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-3 text-zinc-600">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
