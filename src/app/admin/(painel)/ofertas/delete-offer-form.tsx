'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { ui } from '@/components/admin/ui'
import { excluirOferta } from './actions'

type OfferReference = { id: string; name: string }

function DeleteConfirmation({ offer, storeId, onCancel }: {
  offer: OfferReference
  storeId: string
  onCancel(): void
}) {
  const [state, action, pending] = useActionState(excluirOferta, { error: null })
  const [name, setName] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  useEffect(() => { input.current?.focus() }, [])

  return <form action={action} className="mt-4 flex min-w-0 flex-col gap-4">
    <input type="hidden" name="id" value={offer.id} />
    <input type="hidden" name="store_id" value={storeId} />
    <p id={hintId} className="break-words text-sm text-texto-suave [overflow-wrap:anywhere]">
      Confirme a exclusão de <strong className="text-texto">{offer.name}</strong>. Esta ação é permanente.
    </p>
    <label className={ui.label}>
      Digite o nome da oferta
      <input ref={input} name="confirmation" value={name} onChange={event => setName(event.target.value)}
        required autoComplete="off" disabled={pending} aria-describedby={hintId} className={`${ui.input} w-full min-w-0`} />
    </label>
    {state.error && <p role="alert" className={ui.notice}>{state.error}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={pending} onClick={onCancel} className={`${ui.buttonGhost} min-h-11 disabled:opacity-60`}>Cancelar</button>
      <button type="submit" disabled={pending || name.trim() !== offer.name}
        className={`${ui.buttonDanger} min-h-11 disabled:cursor-not-allowed disabled:opacity-60`}>
        {pending ? 'Excluindo…' : 'Excluir definitivamente'}
      </button>
    </div>
  </form>
}

export function DeleteOfferSection({ offer, storeId }: { offer: OfferReference; storeId: string }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const confirmationId = useId()
  return <section aria-labelledby={headingId} className={`${ui.card} max-w-xl min-w-0 p-5`}>
    <h2 id={headingId} className="font-semibold">Excluir oferta</h2>
    <p className="mt-2 text-sm text-texto-suave">
      Remove esta oferta e seus vínculos. Os produtos e conteúdos permanecem cadastrados. Ofertas com qualquer pedido são protegidas.
      Exclua apenas ofertas que não serão mais vendidas. Isso não exclui o produto nem interrompe as vendas na Payt. Depois, você poderá excluir os produtos sem outros vínculos ou histórico.
    </p>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={confirmationId}
      onClick={() => setOpen(true)} className={`${ui.buttonDanger} mt-4 min-h-11`} hidden={open}>Excluir oferta</button>
    <div id={confirmationId}>
      {open && <DeleteConfirmation offer={offer} storeId={storeId} onCancel={() => {
        setOpen(false)
        // Restore focus after React reveals the trigger.
        requestAnimationFrame(() => trigger.current?.focus())
      }} />}
    </div>
  </section>
}
