'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { PreviewContext } from '@/lib/membros/preview-context'

export function PreviewControls({ preview, simulationHref }: { preview: PreviewContext; simulationHref?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <label className="flex flex-wrap items-center gap-2">
    <span className="font-semibold">Visualizar como</span>
    <select aria-label="Modo de visualização" disabled={pending} value={preview === true ? 'editorial' : String(preview)} className="min-h-11 rounded border border-borda bg-fundo px-3 text-texto" onChange={(event) => {
      const mode = event.target.value
      const query = new URLSearchParams(window.location.search)
      query.set('previa', '1')
      query.delete('comprar')
      query.delete('bloqueado')
      if (mode === 'editorial') query.delete('simular')
      else query.set('simular', mode)
      const destination = mode !== 'editorial' && simulationHref ? simulationHref : window.location.pathname
      startTransition(() => router.replace(`${destination}?${query}${window.location.hash}`))
    }}>
      <option value="editorial">Prévia editorial (inclui rascunhos)</option>
      <option value="basic">Simulação: Básico</option>
      <option value="complete">Simulação: Completo</option>
      <option value="locked">Simulação: sem compra</option>
    </select>
    <span role="status">{pending ? 'Atualizando…' : 'Nenhum progresso é registrado'}</span>
  </label>
}
