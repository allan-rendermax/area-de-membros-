'use client'

import { useRef } from 'react'

export function Carousel({ title, children }: { title: string; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const scroll = (direction: 1 | -1) => {
    const el = track.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <section className="group/row relative" aria-label={title}>
      <h2 className="mb-3 px-4 text-lg font-semibold sm:px-8 sm:text-xl">{title}</h2>
      <div ref={track} className="sem-barra flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-4 sm:scroll-px-8 sm:gap-4 sm:px-8">
        {children}
      </div>
      <button
        type="button"
        aria-label={`Voltar em ${title}`}
        onClick={() => scroll(-1)}
        className="absolute top-10 bottom-4 left-0 hidden w-10 items-center justify-center bg-gradient-to-r from-fundo to-transparent text-3xl text-texto opacity-0 transition group-hover/row:opacity-100 focus-visible:opacity-100 sm:flex"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label={`Avançar em ${title}`}
        onClick={() => scroll(1)}
        className="absolute top-10 right-0 bottom-4 hidden w-10 items-center justify-center bg-gradient-to-l from-fundo to-transparent text-3xl text-texto opacity-0 transition group-hover/row:opacity-100 focus-visible:opacity-100 sm:flex"
      >
        ›
      </button>
    </section>
  )
}
