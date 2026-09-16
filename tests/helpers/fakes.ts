import { STATUS_RANK, type CustomerRow, type OrderStatus, type Store } from '@/lib/domain/types'
import type { AccessEmail, ApplyOrderInput, EventOutcome, Mailer, PostbackRepo } from '@/lib/orders/process-postback'

type FakeOrder = ApplyOrderInput & { id: string }

export class FakeRepo implements PostbackRepo {
  store: Store = { id: 'store-1', slug: 'arquitetura', name: 'Arquitetura', logoUrl: null, primaryColor: '#000', supportUrl: null }
  events: { id: string; payload: unknown; keyValid?: boolean; outcome?: EventOutcome; error?: string }[] = []
  orders: FakeOrder[] = []
  customers: CustomerRow[] = []
  titles: Record<string, string[]> = { 'ATLAS-COMPLETO': ['Atlas Visual', 'Bônus 1'] }
  failCreateCustomerTimes = 0
  // Simula outro aviso simultâneo que criou o cliente entre a busca e a criação.
  hideCustomerFromLookupOnce = false

  async logEvent(payload: unknown) {
    const id = `ev-${this.events.length + 1}`
    this.events.push({ id, payload })
    return id
  }
  async finishEvent(id: string, result: { keyValid: boolean; outcome: EventOutcome; error?: string }) {
    Object.assign(this.events.find((e) => e.id === id)!, result)
  }
  async getStoreBySlug(slug: string) {
    return slug === this.store.slug ? this.store : null
  }
  async applyOrderStatus(input: ApplyOrderInput) {
    const existing = this.orders.find(
      (o) => o.transactionId === input.transactionId && o.productCode === input.productCode,
    )
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
  async getMaterialTitlesForProduct(_storeId: string, productCode: string) {
    return this.titles[productCode] ?? []
  }
}

export class FakeMailer implements Mailer {
  sent: AccessEmail[] = []
  fail = false
  async sendAccessGranted(email: AccessEmail) {
    if (this.fail) throw new Error('resend fora do ar')
    this.sent.push(email)
  }
}
