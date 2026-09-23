'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ui } from '@/components/admin/ui'
import { enviarCodigo, verificarCodigo, type AdminLoginState } from './actions'

const initial: AdminLoginState = { step: 'email', email: '', error: null }

export function AdminLoginForm() {
  const [sent, send, sending] = useActionState(enviarCodigo, initial)
  const [verified, verify, verifying] = useActionState(verificarCodigo, initial)
  const [rememberBrowser, setRememberBrowser] = useState(false)
  const rememberInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (rememberInput.current) rememberInput.current.checked = rememberBrowser
  }, [sent, verified, rememberBrowser])

  if (sent.step === 'code') {
    return (
      <form action={verify} className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">Se este e-mail estiver autorizado, você receberá um código em {sent.email}.</p>
        <input key="email-hidden" type="hidden" name="email" value={sent.email} />
        <label htmlFor="admin-login-token" className="text-sm text-texto-suave">Código recebido por e-mail</label>
        <input id="admin-login-token" name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required className={ui.input} placeholder="Código recebido por e-mail" />
        <label className="flex items-start gap-2 text-sm text-texto-suave">
          <input ref={rememberInput} name="rememberBrowser" type="checkbox" checked={rememberBrowser} onChange={(event) => setRememberBrowser(event.target.checked)} className="mt-1 accent-destaque" />
          <span>Confiar neste navegador por 7 dias.<span className="mt-1 block text-xs">Use apenas em um dispositivo pessoal.</span></span>
        </label>
        {verified.error && <p role="alert" className="text-sm text-red-400">{verified.error}</p>}
        <button type="submit" disabled={verifying} className={`${ui.button} text-white hover:bg-red-700`}>{verifying ? 'Verificando…' : 'Entrar'}</button>
        <button type="submit" formAction={send} formNoValidate disabled={sending} className="text-sm text-texto-suave underline underline-offset-4 disabled:opacity-60">
          {sending ? 'Reenviando…' : 'Reenviar código'}
        </button>
      </form>
    )
  }

  return (
    <form action={send} className="flex flex-col gap-4">
      <label htmlFor="admin-login-email" className="text-sm text-texto-suave">E-mail</label>
      <input key="email-entry" id="admin-login-email" name="email" type="email" required defaultValue={sent.email} className={ui.input} placeholder="seu@email.com" />
      {sent.error && <p role="alert" className="text-sm text-red-400">{sent.error}</p>}
      <button type="submit" disabled={sending} className={`${ui.button} text-white hover:bg-red-700`}>{sending ? 'Enviando…' : 'Enviar código'}</button>
    </form>
  )
}
