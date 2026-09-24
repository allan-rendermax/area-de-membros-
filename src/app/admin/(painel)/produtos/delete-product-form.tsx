'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { ui } from '@/components/admin/ui'
import { excluirProduto } from './actions'

type ProductReference = { id: string; title: string }

function DeleteConfirmation({ product, storeId, onCancel }: {
  product: ProductReference
  storeId: string
  onCancel(): void
}) {
  const [state, action, pending] = useActionState(excluirProduto, { error: null })
  const [name, setName] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  useEffect(() => { input.current?.focus() }, [])

  return <form action={action} className="mt-4 flex min-w-0 flex-col gap-4">
    <input type="hidden" name="id" value={product.id} />
    <input type="hidden" name="store_id" value={storeId} />
    <p id={hintId} className="break-words text-sm text-texto-suave [overflow-wrap:anywhere]">
      Confirme a exclusão de <strong className="text-texto">{product.title}</strong>. Esta ação é permanente.
    </p>
    <label className={ui.label}>
      Digite o nome do produto
      <input ref={input} name="confirmation" value={name} onChange={event => setName(event.target.value)}
        required autoComplete="off" disabled={pending} aria-describedby={hintId} className={`${ui.input} w-full min-w-0`} />
    </label>
    {state.error && <p role="alert" className={ui.notice}>{state.error}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={pending} onClick={onCancel} className={`${ui.buttonGhost} min-h-11 disabled:opacity-60`}>Cancelar</button>
      <button type="submit" disabled={pending || name.trim() !== product.title}
        className={`${ui.buttonDanger} min-h-11 disabled:cursor-not-allowed disabled:opacity-60`}>
        {pending ? 'Excluindo…' : 'Excluir definitivamente'}
      </button>
    </div>
  </form>
}

export function DeleteProductSection({ product, storeId }: { product: ProductReference; storeId: string }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const confirmationId = useId()
  return <section aria-labelledby={headingId} className={`${ui.card} min-w-0 p-5`}>
    <h2 id={headingId} className="font-semibold">Excluir produto</h2>
    <p className="mt-2 text-sm text-texto-suave">
      Remove o produto, seus módulos e itens. Produtos vinculados a ofertas ou com histórico de uso ou e-mail são protegidos.
      Para ocultar um produto, desmarque Publicado acima e salve. Os arquivos enviados permanecem no armazenamento.
    </p>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={confirmationId}
      onClick={() => setOpen(true)} className={`${ui.buttonDanger} mt-4 min-h-11`} hidden={open}>Excluir produto</button>
    <div id={confirmationId}>
      {open && <DeleteConfirmation product={product} storeId={storeId} onCancel={() => {
        setOpen(false)
        // Restore focus after React reveals the trigger.
        requestAnimationFrame(() => trigger.current?.focus())
      }} />}
    </div>
  </section>
}
