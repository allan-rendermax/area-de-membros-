import {
  STATUS_RANK,
  type AccessNotice,
  type CustomerRow,
  type EmailKind,
  type NoticeResult,
  type OrderStatus,
  type StoreRef,
} from '@/lib/domain/types'
import type { ApplyOrderInput, EventFinish, PostbackRepo } from '@/lib/orders/process-postback'

export const ARQ: StoreRef = { id: 'store-1', slug: 'arquitetura', name: 'Arquitetura' }

type FakeOrder = ApplyOrderInput & { id: string }

export class FakeRepo implements PostbackRepo {
  storesByCode: Record<string, StoreRef> = { 'ATLAS-COMPLETO': ARQ, 'BUMP-CHECKLIST': ARQ, 'BUMP-PACK': ARQ }
  productsByCode: Record<string, { id: string; title: string }[]> = {
    'ATLAS-COMPLETO': [{ id: 'p-atlas', title: 'Atlas Visual' }, { id: 'p-bonus1', title: 'Bônus 1' }],
    'BUMP-CHECKLIST': [{ id: 'p-check', title: 'Checklist de Vistoria' }],
    'BUMP-PACK': [{ id: 'p-pack', title: 'Pack de Detalhes' }],
  }
  events: ({ id: string; payload: unknown } & Partial<EventFinish>)[] = []
  orders: FakeOrder[] = []
  customers: CustomerRow[] = []
  notices: {
    customerId: string
    storeId: string
    productIds: string[]
    status: 'pendente' | 'falhou' | 'enviado'
    toEmail?: string
    kind?: EmailKind
    error?: string
  }[] = []
  failApplyOnCode: string | null = null
  failLogFailedNotice = false
  failCreateCustomerTimes = 0
  hideCustomerFromLookupOnce = false
  failGetProductsForCode: string | null = null
  failReadOrder = false

  async logEvent(payload: unknown) {
    const id = `ev-${this.events.length + 1}`
    this.events.push({ id, payload })
    return id
  }
  async finishEvent(id: string, result: EventFinish) {
    Object.assign(this.events.find((e) => e.id === id)!, result)
  }
  async findStoreForProductCode(code: string) {
    return this.storesByCode[code] ?? null
  }
  async applyOrderStatus(input: ApplyOrderInput) {
    if (this.failApplyOnCode === input.productCode) throw new Error('gravação indisponível')
    const effectiveEmail = input.customerEmail.trim().toLowerCase()
    const existing = this.orders.find((o) => o.transactionId === input.transactionId && o.productCode === input.productCode)
    if (!existing) {
      const order = { ...input, customerEmail: effectiveEmail, id: `ord-${this.orders.length + 1}` }
      this.orders.push(order)
      if (this.failReadOrder) throw new Error('leitura do pedido indisponível')
      return { orderId: order.id, changed: true, status: order.status, customerEmail: order.customerEmail, customerName: order.customerName }
    }
    if (STATUS_RANK[input.status] > STATUS_RANK[existing.status]) {
      if (existing.status === 'pendente' && input.status === 'pago') {
        existing.customerEmail = effectiveEmail
        existing.customerName = input.customerName
      }
      existing.status = input.status
      if (this.failReadOrder) throw new Error('leitura do pedido indisponível')
      return { orderId: existing.id, changed: true, status: existing.status as OrderStatus, customerEmail: existing.customerEmail, customerName: existing.customerName }
    }
    if (this.failReadOrder) throw new Error('leitura do pedido indisponível')
    return { orderId: existing.id, changed: false, status: existing.status as OrderStatus, customerEmail: existing.customerEmail, customerName: existing.customerName }
  }
  async findCustomerByEmail(email: string) {
    if (this.hideCustomerFromLookupOnce) {
      this.hideCustomerFromLookupOnce = false
      return null
    }
    return this.customers.find((c) => c.email === email) ?? null
  }
  async createCustomer(email: string, name: string) {
    if (this.failCreateCustomerTimes > 0) {
      this.failCreateCustomerTimes--
      throw new Error('auth indisponível')
    }
    const existing = this.customers.find((c) => c.email === email)
    if (existing) return { customer: existing, created: false }
    const customer = { id: `cus-${this.customers.length + 1}`, email, name, blockedAt: null }
    this.customers.push(customer)
    return { customer, created: true }
  }
  async getProductsForCode(code: string) {
    if (this.failGetProductsForCode === code) throw new Error('produtos indisponíveis')
    return this.productsByCode[code] ?? []
  }
  async hasNoticeForProducts(customerId: string, storeId: string, productIds: string[]) {
    if (productIds.length === 0) return false
    return productIds.every((productId) =>
      this.notices.some(
        (notice) =>
          notice.customerId === customerId &&
          notice.storeId === storeId &&
          notice.productIds.includes(productId),
      ),
    )
  }
  async logFailedNotice(entry: {
    storeId: string
    customerId: string
    toEmail: string
    kind: EmailKind
    productIds?: string[]
    error: string
  }) {
    if (this.failLogFailedNotice) throw new Error('registro indisponível')
    this.notices.push({ ...entry, productIds: entry.productIds ?? [], status: 'falhou' })
  }
  markNotified(customerId: string, storeId: string, productIds: string[]) {
    this.notices.push({ customerId, storeId, productIds, status: 'enviado' })
  }
}

export class FakeNotifier {
  sent: AccessNotice[] = []
  fail = false
  throwError = false
  notify = async (notice: AccessNotice): Promise<NoticeResult> => {
    if (this.throwError) throw new Error('notify indisponível')
    if (this.fail) return { ok: false, error: 'resend fora do ar' }
    this.sent.push(notice)
    return { ok: true }
  }
}
