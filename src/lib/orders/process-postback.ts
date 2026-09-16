import { timingSafeEqual } from 'node:crypto'
import type { CustomerRow, OrderStatus, Store } from '@/lib/domain/types'
import { parsePaytPostback } from '@/lib/payt/parse'
import { mapPaytStatus } from '@/lib/payt/status'

export type ApplyOrderInput = {
  storeId: string
  transactionId: string
  productCode: string
  productName: string
  customerEmail: string
  customerName: string
  status: OrderStatus
  paytType: string
  isTest: boolean
  amountCents: number | null
}

export type EventOutcome = 'unauthorized' | 'invalid' | 'ignored' | 'processed' | 'failed'

export interface PostbackRepo {
  logEvent(payload: unknown): Promise<string>
  finishEvent(id: string, result: { keyValid: boolean; outcome: EventOutcome; error?: string }): Promise<void>
  getStoreBySlug(slug: string): Promise<Store | null>
  applyOrderStatus(input: ApplyOrderInput): Promise<{ orderId: string; changed: boolean; status: OrderStatus }>
  findCustomerByEmail(email: string): Promise<CustomerRow | null>
  // created = false quando outro aviso simultâneo criou o cliente primeiro.
  createCustomer(email: string, name: string): Promise<{ customer: CustomerRow; created: boolean }>
  getMaterialTitlesForProduct(storeId: string, productCode: string): Promise<string[]>
}

export type AccessEmail = {
  to: string
  customerName: string
  storeName: string
  materialTitles: string[]
  firstAccess: boolean
}

export interface Mailer {
  sendAccessGranted(email: AccessEmail): Promise<void>
}

export type ProcessResult =
  | { kind: 'unauthorized' }
  | { kind: 'invalid'; error: string }
  | { kind: 'ignored'; reason: string }
  | {
      kind: 'processed'
      orderId: string
      status: OrderStatus
      changed: boolean
      customerCreated: boolean
      emailSent: boolean
      emailError?: string
    }

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

function keyMatches(body: unknown, expected: string): boolean {
  const received =
    body && typeof body === 'object' && typeof (body as Record<string, unknown>).integration_key === 'string'
      ? ((body as Record<string, unknown>).integration_key as string)
      : ''
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function processPostback(
  body: unknown,
  deps: { repo: PostbackRepo; mailer: Mailer; integrationKey: string; storeSlug: string },
): Promise<ProcessResult> {
  const { repo, mailer } = deps
  const eventId = await repo.logEvent(body)

  if (!keyMatches(body, deps.integrationKey)) {
    await repo.finishEvent(eventId, { keyValid: false, outcome: 'unauthorized' })
    return { kind: 'unauthorized' }
  }

  const parsed = parsePaytPostback(body)
  if (!parsed.ok) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'invalid', error: parsed.error })
    return { kind: 'invalid', error: parsed.error }
  }
  const p = parsed.value

  const status = mapPaytStatus(p.status)
  if (!status) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'ignored', error: `status ignorado: ${p.status}` })
    return { kind: 'ignored', reason: p.status }
  }

  try {
    const store = await repo.getStoreBySlug(deps.storeSlug)
    if (!store) throw new Error(`Loja não encontrada: ${deps.storeSlug}`)

    const order = await repo.applyOrderStatus({
      storeId: store.id,
      transactionId: p.transactionId,
      productCode: p.productCode,
      productName: p.productName,
      customerEmail: p.customerEmail,
      customerName: p.customerName,
      status,
      paytType: p.type,
      isTest: p.isTest,
      amountCents: p.amountCents,
    })

    let customerCreated = false
    let emailSent = false
    let emailError: string | undefined

    if (order.status === 'pago') {
      const existing = await repo.findCustomerByEmail(p.customerEmail)
      if (!existing) {
        const { created } = await repo.createCustomer(p.customerEmail, p.customerName)
        customerCreated = created
      }

      if (order.changed || customerCreated) {
        try {
          const materialTitles = await repo.getMaterialTitlesForProduct(store.id, p.productCode)
          await mailer.sendAccessGranted({
            to: p.customerEmail,
            customerName: p.customerName,
            storeName: store.name,
            materialTitles,
            firstAccess: customerCreated,
          })
          emailSent = true
        } catch (e) {
          emailError = errorMessage(e)
        }
      }
    }

    await repo.finishEvent(eventId, {
      keyValid: true,
      outcome: 'processed',
      error: emailError ? `falha no email: ${emailError}` : undefined,
    })

    return {
      kind: 'processed',
      orderId: order.orderId,
      status: order.status,
      changed: order.changed,
      customerCreated,
      emailSent,
      ...(emailError ? { emailError } : {}),
    }
  } catch (e) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'failed', error: errorMessage(e) })
    throw e
  }
}
