'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { changeCustomerEmail, setCustomerBlocked } from '@/lib/data/customers'
import { createManualOrder, revokeManualOrder } from '@/lib/data/orders'
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
  const store = await getAdminStore()
  const result = await resendAccessForCustomer(id, store.id)
  back(id, result.ok ? 'E-mail de acesso reenviado.' : `Falha ao enviar: ${result.error}`)
}

export async function liberarAcessoManual(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const offerId = String(formData.get('offerId') ?? '')
  if (!isUuid(id) || !isUuid(offerId)) back(id, 'Cliente ou oferta inválidos.')
  const store = await getAdminStore()
  try {
    await createManualOrder({
      storeId: store.id,
      offerId,
      customerId: id,
      adminEmail: admin.email,
      note: String(formData.get('note') ?? '').trim(),
    })
  } catch (e) {
    back(id, e instanceof Error ? e.message : 'Não foi possível liberar o acesso.')
  }
  revalidatePath(`/admin/clientes/${id}/vitrine`)
  back(id, 'Acesso manual liberado.')
}

export async function removerAcessoManual(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const orderId = String(formData.get('orderId') ?? '')
  if (!isUuid(id) || !isUuid(orderId)) back(id, 'Cliente ou pedido inválidos.')
  const store = await getAdminStore()
  try {
    await revokeManualOrder({ orderId, storeId: store.id, customerId: id })
  } catch (e) {
    back(id, e instanceof Error ? e.message : 'Não foi possível remover o acesso.')
  }
  revalidatePath(`/admin/clientes/${id}/vitrine`)
  back(id, 'Acesso manual removido. Pedido cancelado; outros pedidos pagos continuam válidos.')
}
