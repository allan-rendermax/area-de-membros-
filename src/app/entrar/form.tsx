'use client'

import { useActionState } from 'react'
import { entrar, type EntrarState } from './actions'

export function EntrarForm({ initialEmail, supportUrl }: { initialEmail: string; supportUrl: string | null }) {
  const [state, action, pending] = useActionState<EntrarState, FormData>(entrar, { error: null, email: initialEmail })

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-grafite">
        Email usado na compra
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="rounded-md border border-junta bg-white px-4 py-3 text-base text-tinta outline-none focus:border-tinta focus-visible:outline-none"
        />
      </label>
      {state.error && (
        <p role="alert" className="border-l-[3px] border-sinal bg-sinal/10 px-3 py-2 text-sm leading-relaxed text-tinta">
          {state.error}
          {supportUrl && (
            <>
              {' '}
              <a href={supportUrl} className="font-semibold underline">Falar com o suporte</a>
            </>
          )}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-tinta px-4 py-3.5 font-semibold text-papel hover:bg-tinta-suave disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
