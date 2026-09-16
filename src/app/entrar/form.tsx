'use client'

import { useActionState } from 'react'
import { entrar, type EntrarState } from './actions'

export function EntrarForm({ initialEmail, supportUrl }: { initialEmail: string; supportUrl: string | null }) {
  const [state, action, pending] = useActionState<EntrarState, FormData>(entrar, { error: null, email: initialEmail })

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Email usado na compra
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-900"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
          {supportUrl && (
            <>
              {' '}
              <a href={supportUrl} className="underline">Falar com o suporte</a>
            </>
          )}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
