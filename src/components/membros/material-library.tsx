'use client'
import Link from 'next/link'
import { useId, useState } from 'react'
import type { ShelfProduct } from '@/lib/access/access'
import { AutoCover } from './auto-cover'

function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim() }

export function MaterialLibrary({ products, storeSlug }: { products: ShelfProduct[]; storeSlug: string }) {
  const [query, setQuery] = useState('')
  const inputId = useId()
  const acquired = products.filter((product) => product.unlocked)
  const visible = acquired.filter((product) => normalize(`${product.title} ${product.track}`).includes(normalize(query)))
  return <section id="materiais" aria-labelledby={`${inputId}-heading`} className="scroll-mt-24">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
      <h2 id={`${inputId}-heading`} className="text-2xl font-bold sm:text-3xl">Meus materiais</h2>
      {acquired.length > 1 && <div className="w-full sm:w-80">
        <label htmlFor={inputId} className="mb-2 block text-sm text-texto-suave">Buscar por nome ou categoria</label>
        <input id={inputId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full rounded-lg border border-borda bg-superficie px-3 text-texto outline-offset-4" placeholder="Buscar nos meus materiais" />
      </div>}
    </div>
    {acquired.length === 0 ? <div className="py-5"><h3 className="font-semibold">Nenhum material liberado ainda</h3><p className="mt-2 max-w-prose text-texto-suave">Após a confirmação do pagamento, seus materiais aparecem aqui. Confira se entrou com o e-mail da compra.</p></div> : visible.length === 0 ? <div role="status" className="py-5"><p>Nenhum material encontrado para “{query}”.</p><button type="button" onClick={() => setQuery('')} className="mt-3 min-h-11 font-semibold text-destaque underline underline-offset-4">Limpar busca</button></div> : <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {visible.map((product) => <li key={product.id} className="min-w-0"><Link href={`/${storeSlug}/produto/${product.slug}`} className="group block min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"><AutoCover seed={product.id} title={product.title} imageUrl={product.coverUrl} aspect="poster" /><h3 className="mt-3 break-words font-semibold leading-snug [overflow-wrap:anywhere] group-hover:text-destaque">{product.title}</h3>{product.track && <p className="mt-1 break-words text-sm text-texto-suave [overflow-wrap:anywhere]">{product.track}</p>}</Link></li>)}
    </ul>}
  </section>
}
