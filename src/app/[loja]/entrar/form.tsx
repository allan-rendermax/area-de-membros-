'use client'

import { useActionState } from 'react'
import type { EntrarState } from './actions'

export function EntrarForm({
  action,
  initialEmail,
}: {
  action: (state: EntrarState, formData: FormData) => Promise<EntrarState>
  initialEmail: string
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, email: initialEmail })

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-texto-suave">
        E-mail usado na compra
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="rounded-md border border-borda bg-fundo px-4 py-3 text-base text-texto outline-none focus:border-destaque"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-md border border-destaque/40 bg-destaque/10 px-3 py-2 text-sm">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-md bg-destaque px-4 py-3 font-semibold text-texto hover:bg-destaque-hover disabled:opacity-60">
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
