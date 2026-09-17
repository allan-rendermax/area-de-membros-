import {
  STATUS_RANK,
  type AccessNotice,
  type CustomerRow,
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
  failCreateCustomerTimes = 0
  hideCustomerFromLookupOnce = false
  failGetProductsForCode: string | null = null

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
    const existing = this.orders.find((o) => o.transactionId === input.transactionId && o.productCode === input.productCode)
    if (!existing) {
      const order = { ...input, id: `ord-${this.orders.length + 1}` }
      this.orders.push(order)
      return { orderId: order.id, changed: true, status: order.status }
    }
    if (STATUS_RANK[input.status] > STATUS_RANK[existing.status]) {
      existing.status = input.status
      return { orderId: existing.id, changed: true, status: existing.status as OrderStatus }
    }
    return { orderId: existing.id, changed: false, status: existing.status as OrderStatus }
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
