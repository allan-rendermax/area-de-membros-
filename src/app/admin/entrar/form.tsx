'use client'

import { useActionState } from 'react'
import { ui } from '@/components/admin/ui'
import { enviarCodigo, verificarCodigo, type AdminLoginState } from './actions'

const initial: AdminLoginState = { step: 'email', email: '', error: null }

export function AdminLoginForm() {
  const [sent, send, sending] = useActionState(enviarCodigo, initial)
  const [verified, verify, verifying] = useActionState(verificarCodigo, initial)

  if (sent.step === 'code') {
    return (
      <form action={verify} className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">Se este e-mail estiver autorizado, você receberá um código em {sent.email}.</p>
        <input type="hidden" name="email" value={sent.email} />
        <input name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required className={ui.input} placeholder="Código recebido por e-mail" />
        {verified.error && <p role="alert" className="text-sm text-destaque">{verified.error}</p>}
        <button type="submit" disabled={verifying} className={ui.button}>{verifying ? 'Verificando…' : 'Entrar'}</button>
      </form>
    )
  }

  return (
    <form action={send} className="flex flex-col gap-4">
      <input name="email" type="email" required defaultValue={sent.email} className={ui.input} placeholder="seu@email.com" />
      {sent.error && <p role="alert" className="text-sm text-destaque">{sent.error}</p>}
      <button type="submit" disabled={sending} className={ui.button}>{sending ? 'Enviando…' : 'Enviar código'}</button>
    </form>
  )
}
