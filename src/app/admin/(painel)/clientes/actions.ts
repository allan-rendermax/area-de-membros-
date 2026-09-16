'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadCustomerAccess } from '@/lib/data/access'
import { changeCustomerEmail, getCustomer, setCustomerBlocked } from '@/lib/data/customers'
import { getDefaultStore } from '@/lib/data/stores'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'
import { createResendMailer } from '@/lib/email/resend-mailer'

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
  const customer = await getCustomer(id)
  if (!customer) back(id, 'Cliente não encontrado.')

  const store = await getDefaultStore()
  const { materials, granted } = await loadCustomerAccess(store.id, customer.email)
  const materialTitles = materials.filter((m) => m.isPublished && granted.has(m.id)).map((m) => m.title)

  try {
    await createResendMailer().sendAccessGranted({
      to: customer.email,
      customerName: customer.name,
      storeName: store.name,
      materialTitles,
      firstAccess: true,
    })
  } catch (e) {
    back(id, `Falha ao enviar: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
  }
  back(id, 'Email de acesso reenviado.')
}
