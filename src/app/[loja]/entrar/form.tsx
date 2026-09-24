'use client'

import Script from 'next/script'
import { useActionState, useEffect } from 'react'
import type { EntrarState } from './actions'

type TurnstileWindow = Window & { turnstile?: { reset(): void } }

export function EntrarForm({
  action,
  initialEmail,
  stamp,
  turnstileSiteKey,
}: {
  action: (state: EntrarState, formData: FormData) => Promise<EntrarState>
  initialEmail: string
  stamp: string
  turnstileSiteKey: string | null
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, email: initialEmail, supportHref: null })

  useEffect(() => {
    if (state.error) (window as TurnstileWindow).turnstile?.reset()
  }, [state])

  return (
    <form action={formAction} className="relative mt-5 flex flex-col gap-4">
      <input type="hidden" name="stamp" value={stamp} />
      <div className="absolute top-0 -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-texto-suave">
        E-mail
        <input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.email}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? 'email-error' : undefined}
          disabled={pending}
          className="rounded-md border border-borda bg-fundo px-4 py-3 text-base text-texto outline-none focus:border-destaque"
        />
      </label>

      {state.error && (
        <div id="email-error" role="alert" className="rounded-md border border-destaque/40 bg-destaque/10 px-3 py-2 text-sm text-texto">
          <p>{state.error}</p>
          {state.supportHref && (
            <a href={state.supportHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-semibold underline underline-offset-4">
              Falar com o suporte
            </a>
          )}
        </div>
      )}

      {turnstileSiteKey && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="dark" data-size="flexible" />
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-md bg-destaque px-4 py-3 font-semibold text-texto hover:bg-destaque-hover disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
