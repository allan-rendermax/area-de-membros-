'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { changeCustomerEmail, setCustomerBlocked } from '@/lib/data/customers'
import { getDefaultStore } from '@/lib/data/stores'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'
import { resendAccessForCustomer } from '@/lib/email/server'

function back(id: string, message: string): never {
  revalidatePath(`/admin/clientes/${id}`)
  redirect(`/admin/clientes/${id}?msg=${encodeURIComponent(message)}`)
}

export async function alternarBloqueio(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  const block = formData.get('block') === 'true'
  await setCustomerBlocked(id, block)
  back(id, block ? 'Cliente bloqueado.' : 'Cliente desbloqueado.')
}

export async function corrigirEmail(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  const email = normalizeEmail(String(formData.get('email') ?? ''))
  if (!isValidEmail(email)) back(id, 'Email inválido.')
  try {
    await changeCustomerEmail(id, email)
  } catch (e) {
    back(id, e instanceof Error ? e.message : 'Não foi possível alterar o email.')
  }
  back(id, 'Email alterado.')
}

export async function reenviarAcesso(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  const store = await getDefaultStore()
  const result = await resendAccessForCustomer(id, store.id)
  back(id, result.ok ? 'E-mail de acesso reenviado.' : `Falha ao enviar: ${result.error}`)
}
