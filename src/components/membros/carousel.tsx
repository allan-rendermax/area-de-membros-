'use client'

import { useEffect, useRef, useState } from 'react'
import { useMemberTheme } from './member-theme'

const arrowClassName = 'pointer-events-auto flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/70 bg-[#17191c] text-white shadow-[0_0_0_1px_rgba(0,0,0,0.8),0_4px_14px_rgba(0,0,0,0.6)] hover:border-white hover:bg-[#2b2f35] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-safe:transition-colors'

export function Carousel({ title, children }: { title: string; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const [directions, setDirections] = useState({ left: false, right: false })
  const theme = useMemberTheme()

  useEffect(() => {
    const el = track.current
    if (!el) return

    const measure = () => {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
      const overflows = el.clientWidth > 0 && maxScroll > 1
      const left = overflows && el.scrollLeft > 1
      const right = overflows && maxScroll - el.scrollLeft > 1
      setDirections((previous) => previous.left === left && previous.right === right ? previous : { left, right })
    }
    const frame = requestAnimationFrame(measure)
    el.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)

    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [children])

  const scroll = (direction: 1 | -1) => {
    const el = track.current
    const reducedMotion = theme === 'arquitetura' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  return (
    <section className="group/row relative" aria-label={title}>
      <h2 className="member-shelf-title mb-3 px-4 text-lg font-semibold sm:px-8 sm:text-xl">{title}</h2>
      <div ref={track} className="sem-barra flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-4 sm:scroll-px-8 sm:gap-4 sm:px-8">
        {children}
      </div>
      {directions.left && <div className="pointer-events-none absolute top-10 bottom-4 left-2 z-10 hidden w-12 items-center justify-center sm:flex">
        <button
          type="button"
          aria-label={`Voltar em ${title}`}
          onClick={() => scroll(-1)}
          className={arrowClassName}
        >
          <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </button>
      </div>}
      {directions.right && <div className="pointer-events-none absolute top-10 right-2 bottom-4 z-10 hidden w-12 items-center justify-center sm:flex">
        <button
          type="button"
          aria-label={`Avançar em ${title}`}
          onClick={() => scroll(1)}
          className={arrowClassName}
        >
          <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m10 6 6 6-6 6" />
          </svg>
        </button>
      </div>}
    </section>
  )
}
