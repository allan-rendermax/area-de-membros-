'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { ui } from '@/components/admin/ui'
import { excluirCliente } from './actions'

type CustomerReference = { id: string; email: string }

function DeleteConfirmation({ customer, onCancel }: {
  customer: CustomerReference
  onCancel(): void
}) {
  const [state, action, pending] = useActionState(excluirCliente, { error: null })
  const [email, setEmail] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  useEffect(() => { input.current?.focus() }, [])

  return <form action={action} className="mt-4 flex min-w-0 flex-col gap-4">
    <input type="hidden" name="id" value={customer.id} />
    <p id={hintId} className="break-words text-sm text-texto-suave [overflow-wrap:anywhere]">
      Confirme a exclusão de <strong className="text-texto">{customer.email}</strong>. Esta ação é permanente.
    </p>
    <label className={ui.label}>
      Digite o e-mail do cliente
      <input ref={input} name="confirmation" value={email} onChange={event => setEmail(event.target.value)}
        required autoComplete="off" disabled={pending} aria-describedby={hintId} className={`${ui.input} w-full min-w-0`} />
    </label>
    {state.error && <p role="alert" className={ui.notice}>{state.error}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={pending} onClick={onCancel} className={`${ui.buttonGhost} min-h-11 disabled:opacity-60`}>Cancelar</button>
      <button type="submit" disabled={pending || email.trim().toLowerCase() !== customer.email.trim().toLowerCase()}
        className={`${ui.buttonDanger} min-h-11 disabled:cursor-not-allowed disabled:opacity-60`}>
        {pending ? 'Excluindo…' : 'Excluir definitivamente'}
      </button>
    </div>
  </form>
}

export function DeleteCustomerSection({ customer }: { customer: CustomerReference }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const confirmationId = useId()
  return <section aria-labelledby={headingId} className={`${ui.card} max-w-xl min-w-0 p-5`}>
    <h2 id={headingId} className="font-semibold">Excluir cliente</h2>
    <p className="mt-2 text-sm text-texto-suave">
      Apaga a conta de login, todos os pedidos, acessos, progresso, aparelhos e registros vinculados a este cliente em todas as lojas. Esta ação não pode ser desfeita.
    </p>
    <p className="mt-2 text-sm text-texto-suave">
      A exclusão ocorre nesta área de membros e não cancela compras na Payt. Novos avisos ou reenvios de compra da Payt poderão cadastrar o cliente novamente. Contas de administrador são protegidas.
    </p>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={confirmationId}
      onClick={() => setOpen(true)} className={`${ui.buttonDanger} mt-4 min-h-11`} hidden={open}>Excluir cliente</button>
    <div id={confirmationId}>
      {open && <DeleteConfirmation customer={customer} onCancel={() => {
        setOpen(false)
        // Restore focus after React reveals the trigger.
        requestAnimationFrame(() => trigger.current?.focus())
      }} />}
    </div>
  </section>
}
