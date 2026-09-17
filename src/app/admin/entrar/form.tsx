'use client'

import { useActionState } from 'react'
import { enviarCodigo, verificarCodigo, type AdminLoginState } from './actions'

const initial: AdminLoginState = { step: 'email', email: '', error: null }
const input = 'rounded-lg border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-900'
const button = 'rounded-lg bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-60'

export function AdminLoginForm() {
  const [sent, send, sending] = useActionState(enviarCodigo, initial)
  const [verified, verify, verifying] = useActionState(verificarCodigo, initial)

  if (sent.step === 'code') {
    return (
      <form action={verify} className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600">Enviamos um código para {sent.email}.</p>
        <input type="hidden" name="email" value={sent.email} />
        <input name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required className={input} placeholder="Código recebido por email" />
        {verified.error && <p role="alert" className="text-sm text-red-700">{verified.error}</p>}
        <button type="submit" disabled={verifying} className={button}>{verifying ? 'Verificando…' : 'Entrar'}</button>
      </form>
    )
  }

  return (
    <form action={send} className="flex flex-col gap-4">
      <input name="email" type="email" required defaultValue={sent.email} className={input} placeholder="seu@email.com" />
      {sent.error && <p role="alert" className="text-sm text-red-700">{sent.error}</p>}
      <button type="submit" disabled={sending} className={button}>{sending ? 'Enviando…' : 'Enviar código'}</button>
    </form>
  )
}
