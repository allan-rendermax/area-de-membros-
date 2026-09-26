'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ui } from '@/components/admin/ui'
import type { Product } from '@/lib/domain/types'

const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function ProductSelect({ products, value, onChange, label, disabled = false }: {
  products: Product[]; value: string; onChange: (id: string) => void; label: string; disabled?: boolean
}) {
  const id = useId()
  const list = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const selected = products.find(product => product.id === value)
  const title = selected?.title ?? (value ? 'Produto indisponível' : '')
  const options = products.filter(product => searchable(product.title).includes(searchable(query.trim())))
  const expanded = open && !disabled

  useEffect(() => {
    list.current?.children[active]?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  function show() {
    if (disabled || open) return
    setQuery('')
    setActive(-1)
    setOpen(true)
  }
  function choose(productId: string) {
    if (disabled) return
    onChange(productId)
    setOpen(false)
    setActive(-1)
  }

  return <div className="relative min-w-0">
    <div className="relative">
      <input
        ref={input => { input?.setCustomValidity(value ? '' : 'Selecione um produto da lista.') }}
        role="combobox" aria-label={label} aria-expanded={expanded} aria-controls={`${id}-options`}
        aria-autocomplete="list" aria-activedescendant={expanded && options[active] ? `${id}-option-${active}` : undefined}
        autoComplete="off" required={!value} disabled={disabled}
        value={expanded ? query : title} placeholder={expanded ? 'Buscar produto…' : 'Selecione um produto…'}
        className={`${ui.input} w-full min-w-0 pr-9`}
        onFocus={show} onClick={show}
        onBlur={() => { setOpen(false); setActive(-1) }}
        onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true) }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!expanded) { show(); return }
            setActive(current => event.key === 'ArrowDown'
              ? Math.min(current + 1, options.length - 1)
              : current <= 0 ? options.length - 1 : current - 1)
          } else if (event.key === 'Enter' && expanded) {
            event.preventDefault()
            if (options[active]) choose(options[active].id)
          } else if (event.key === 'Escape' && expanded) {
            event.preventDefault()
            setOpen(false)
            setActive(-1)
          }
        }}
      />
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-texto-suave">▾</span>
    </div>
    {expanded && <div className="absolute left-0 right-0 z-20 mt-1 rounded-md border border-borda bg-superficie shadow-lg">
      <ul ref={list} id={`${id}-options`} role="listbox" aria-label={label} className="max-h-60 overflow-y-auto p-1">
        {options.map((product, index) => <li
          key={product.id} id={`${id}-option-${index}`} role="option" aria-selected={product.id === value}
          className={`cursor-pointer break-words rounded px-3 py-2 text-sm ${active === index ? 'bg-superficie-2' : 'hover:bg-superficie-2'}`}
          onMouseDown={event => event.preventDefault()}
          onClick={() => choose(product.id)}
        >{product.title}</li>)}
      </ul>
      {options.length === 0 && <p role="status" className="px-3 py-2 text-sm text-texto-suave">Nenhum produto encontrado.</p>}
    </div>}
  </div>
}
