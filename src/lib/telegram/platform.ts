import { loadStoreAccess } from '@/lib/data/access'
import { changeCustomerEmail, findCustomerByEmail, getCustomer } from '@/lib/data/customers'
import { countEmailsUsedToday } from '@/lib/data/email-log'
import { getStoreBySlug } from '@/lib/data/stores'
import { buildResendNotice, notifyAccess } from '@/lib/email/server'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { deliveryLabel, readProviderEmail } from './client'
import { createSupportOperations, type OperationData } from './operations'
import type { CustomerLookup } from './types'

function customer(c: Awaited<ReturnType<typeof getCustomer>>): CustomerLookup['customer'] {
  return c ? { id: c.id, email: c.email, name: c.name, blocked: Boolean(c.blockedAt) } : null
}
export async function createPlatformOperations(storeSlug: string) {
  const store = await getStoreBySlug(storeSlug)
  if (!store) throw new Error('telegram_store_missing')
  const db = createAdminClient()
  let providerReadAt = 0
  const data: OperationData = {
    async getCustomer(id) { return customer(await getCustomer(id)) },
    async findCustomer(email) { return customer(await findCustomerByEmail(email)) },
    async search(email) {
      const local = email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 6)
      if (local.length < 4) return []
      for (const prefix of [...new Set([local, local.slice(0, 4)])]) {
        const { data, error } = await db.from('customers').select('id,email,name').ilike('email', `${prefix}%`).order('email').limit(5)
        if (error) throw new Error('telegram_search_failed')
        if (data?.length) return data
      }
      return []
    },
    async authEmail(id) {
      const { data, error } = await db.auth.admin.getUserById(id)
      if (error) throw new Error('telegram_identity_read_failed')
      return data.user.email ?? null
    },
    async destinationExists(email) {
      if (await findCustomerByEmail(email)) return true
      const { data, error } = await db.rpc('get_auth_user_id_by_email', { p_email: email })
      if (error) throw new Error('telegram_destination_read_failed')
      return Boolean(data)
    },
    async access(c) {
      const access = await loadStoreAccess(store.id, c.email)
      return access.products.filter(p => p.isPublished && access.granted.has(p.id)).sort((a, b) => a.sortOrder - b.sortOrder).map(p => ({ id: p.id, title: p.title, level: access.levels.get(p.id)! }))
    },
    async orders(email) {
      const { data, error } = await db.from('orders').select('payt_transaction_id,status').eq('customer_email', email).eq('store_id', store.id).eq('is_test', false).order('created_at', { ascending: false }).limit(20)
      if (error) throw new Error('telegram_orders_read_failed')
      return [...new Map((data ?? []).map(o => [`${o.payt_transaction_id}:${o.status}`, { transaction: o.payt_transaction_id, status: o.status }])).values()]
    },
    async delivery(customerId) {
      const { data, error } = await db.from('email_log').select('provider_id,status,to_email,created_at').eq('customer_id', customerId).eq('store_id', store.id).order('created_at', { ascending: false }).limit(8)
      if (error) throw new Error('telegram_email_log_read_failed')
      for (const log of data ?? []) {
        if (!log.provider_id) return log.status === 'falhou' ? 'Falha registrada no envio' : 'Sem confirmação do provedor'
        const delay = 650 - (Date.now() - providerReadAt)
        if (delay > 0) await new Promise(r => setTimeout(r, delay))
        providerReadAt = Date.now()
        const result = await readProviderEmail(log.provider_id, env.resendApiKey)
        if (!result) return 'Status indisponível no provedor; consulte novamente'
        // Historical campaigns used kind=reenvio for WhatsApp invitations as well.
        if (/seu convite para o clube/i.test(result.subject)) continue
        return `${deliveryLabel(result.event)}\nDestinatário: ${log.to_email}\nData: ${new Date(log.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
      }
      return 'Nenhum aviso de acesso encontrado nos últimos oito registros'
    },
    async quotaAvailable() { return (await countEmailsUsedToday()) < env.emailDailyLimit },
    changeEmail: changeCustomerEmail,
    async send(customerId, storeId, expectedEmail) {
      // Reject development URLs so a support action cannot send localhost links.
      const url = new URL(env.appUrl)
      if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('telegram_app_url_invalid')
      if (storeId !== store.id || !(await data.quotaAvailable())) return { ok: false }
      const notice = await buildResendNotice({ storeId, customerId })
      if (!notice || notice.to !== expectedEmail) throw new Error('telegram_recipient_changed')
      const result = await notifyAccess(notice)
      return { ok: result.ok, logId: result.logId }
    },
  }
  return createSupportOperations({ storeId: store.id, storeName: store.name, adminEmails: env.adminEmails }, data)
}
