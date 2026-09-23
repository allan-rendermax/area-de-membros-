import { timingSafeEqual } from 'node:crypto'
import type { AccessNotice, CustomerRow, EmailKind, NoticeResult, OrderStatus, StoreRef } from '@/lib/domain/types'
import { parsePaytPostback, type PaytProductLine } from '@/lib/payt/parse'
import { mapPaytStatus } from '@/lib/payt/status'

export type ApplyOrderInput = {
  storeId: string | null
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

export type EventOutcome =
  | 'chave_invalida'
  | 'invalido'
  | 'ignorado'
  | 'teste'
  | 'liberado'
  | 'atualizado'
  | 'sem_mudanca'
  | 'codigo_desconhecido'
  | 'erro'

export type EventFinish = {
  keyValid: boolean
  outcome: EventOutcome
  error?: string
  customerEmail?: string
  productCodes?: string[]
  paytStatus?: string
}

export interface PostbackRepo {
  logEvent(payload: unknown): Promise<string>
  finishEvent(id: string, result: EventFinish): Promise<void>
  findStoreForProductCode(code: string): Promise<StoreRef | null>
  applyOrderStatus(input: ApplyOrderInput): Promise<{ orderId: string; changed: boolean; status: OrderStatus; customerEmail: string; customerName: string }>
  findCustomerByEmail(email: string): Promise<CustomerRow | null>
  // created = false quando outro aviso simultâneo criou o cliente primeiro.
  createCustomer(email: string, name: string): Promise<{ customer: CustomerRow; created: boolean }>
  getProductsForCode(code: string): Promise<{ id: string; title: string }[]>
  hasNoticeForProducts(customerId: string, storeId: string, productIds: string[]): Promise<boolean>
  logFailedNotice(entry: {
    storeId: string
    customerId: string
    toEmail: string
    kind: EmailKind
    productIds: string[]
    error: string
  }): Promise<void>
}

export type ProcessedLine = { code: string; storeId: string | null; orderId: string; changed: boolean; status: OrderStatus }

export type ProcessResult =
  | { kind: 'unauthorized' }
  | { kind: 'invalid'; error: string }
  | { kind: 'ignored'; reason: string }
  | {
      kind: 'processed'
      outcome: 'liberado' | 'atualizado' | 'sem_mudanca' | 'codigo_desconhecido'
      status: OrderStatus
      lines: ProcessedLine[]
      unknownCodes: string[]
      customerCreated: boolean
      emailsSent: number
      emailErrors: string[]
    }

type Line = { product: PaytProductLine; store: StoreRef | null; orderId: string; changed: boolean; status: OrderStatus; customerEmail: string; customerName: string }

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

function storesOf(lines: Line[]): StoreRef[] {
  const stores = new Map<string, StoreRef>()
  for (const line of lines) if (line.store) stores.set(line.store.id, line.store)
  return [...stores.values()]
}

async function productsFor(repo: PostbackRepo, lines: Line[]): Promise<{ id: string; title: string }[]> {
  const products = new Map<string, { id: string; title: string }>()
  for (const line of lines) {
    for (const product of await repo.getProductsForCode(line.product.code)) {
      if (!products.has(product.id)) products.set(product.id, product)
    }
  }
  return [...products.values()]
}

export async function processPostback(
  body: unknown,
  deps: { repo: PostbackRepo; notify(notice: AccessNotice): Promise<NoticeResult>; integrationKey: string },
): Promise<ProcessResult> {
  const { repo } = deps
  const eventId = await repo.logEvent(body)

  if (!keyMatches(body, deps.integrationKey)) {
    await repo.finishEvent(eventId, { keyValid: false, outcome: 'chave_invalida' })
    return { kind: 'unauthorized' }
  }

  const parsed = parsePaytPostback(body)
  if (!parsed.ok) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'invalido', error: parsed.error })
    return { kind: 'invalid', error: parsed.error }
  }
  const p = parsed.value
  const summary = { customerEmail: p.customerEmail, productCodes: p.products.map((x) => x.code), paytStatus: p.status }

  // O botão Testar URL envia produtos fictícios. Confirma o recebimento sem
  // percorrer o fluxo de compra ou alterar acessos, mesmo para códigos conhecidos.
  if (p.isTest) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'teste', ...summary })
    return { kind: 'ignored', reason: 'teste_conexao' }
  }

  const status = mapPaytStatus(p.status)
  if (!status) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'ignorado', error: `status ignorado: ${p.status}`, ...summary })
    return { kind: 'ignored', reason: p.status }
  }

  try {
    const lines: Line[] = []
    for (const product of p.products) {
      const store = await repo.findStoreForProductCode(product.code)
      const order = await repo.applyOrderStatus({
        storeId: store?.id ?? null,
        transactionId: p.transactionId,
        productCode: product.code,
        productName: product.name,
        customerEmail: p.customerEmail,
        customerName: p.customerName,
        status,
        paytType: p.type,
        isTest: p.isTest,
        amountCents: product.amountCents,
      })
      lines.push({ product, store, orderId: order.orderId, changed: order.changed, status: order.status, customerEmail: order.customerEmail, customerName: order.customerName })
    }

    const unknownCodes = lines.filter((l) => !l.store).map((l) => l.product.code)
    const paid = lines.filter((l) => l.status === 'pago')
    let customerCreated = false
    let emailsSent = 0
    let granted = false
    const emailErrors: string[] = []

    if (paid.length > 0) {
      const identities = new Map<string, Line[]>()
      for (const line of paid) {
        const email = line.customerEmail.trim().toLowerCase()
        const group = identities.get(email) ?? []
        group.push(line)
        identities.set(email, group)
      }

      for (const [email, identityLines] of identities) {
        // A primeira linha define o nome quando o mesmo titular tem nomes distintos no pedido.
        const name = identityLines[0].customerName
        let customer = await repo.findCustomerByEmail(email)
        let createdForIdentity = false
        if (!customer) {
          const created = await repo.createCustomer(email, name)
          customer = created.customer
          createdForIdentity = created.created
          customerCreated ||= created.created
        }

        for (const store of storesOf(identityLines)) {
          const storeLines = identityLines.filter((l) => l.store?.id === store.id)
          let products: { id: string; title: string }[] = []
          try {
            products = await productsFor(repo, storeLines)
            if (products.length === 0) {
              emailErrors.push(`nenhum produto publicado para a loja ${store.id}`)
              continue
            }
            const productIds = products.map((product) => product.id)
            if (
              !createdForIdentity &&
              !storeLines.some((line) => line.changed) &&
              (await repo.hasNoticeForProducts(customer.id, store.id, productIds))
            ) {
              continue
            }
            granted = true
            const result = await deps.notify({
              customerId: customer.id,
              to: email,
              customerName: name,
              store,
              products,
              kind: createdForIdentity ? 'acesso_novo' : 'produto_novo',
            })
            if (result.ok) emailsSent++
            else emailErrors.push(result.error)
          } catch (e) {
            granted = true
            emailErrors.push(errorMessage(e))
            try {
              await repo.logFailedNotice({
                storeId: store.id,
                customerId: customer.id,
                toEmail: email,
                kind: createdForIdentity ? 'acesso_novo' : 'produto_novo',
                productIds: products.map((product) => product.id),
                error: errorMessage(e),
              })
            } catch {
              // O erro original continua no evento mesmo se o registro de email falhar.
            }
          }
        }
      }
    }

    const outcome = granted
      ? 'liberado'
      : lines.some((l) => l.store && l.changed)
        ? 'atualizado'
        : unknownCodes.length === lines.length
          ? 'codigo_desconhecido'
          : 'sem_mudanca'
    const errors = [
      ...(unknownCodes.length ? [`códigos desconhecidos: ${unknownCodes.join(', ')}`] : []),
      ...emailErrors.map((e) => `falha no email: ${e}`),
    ]

    await repo.finishEvent(eventId, {
      keyValid: true,
      outcome,
      ...summary,
      ...(errors.length ? { error: errors.join(' | ') } : {}),
    })

    return {
      kind: 'processed',
      outcome,
      status: lines[0].status,
      lines: lines.map((l) => ({ code: l.product.code, storeId: l.store?.id ?? null, orderId: l.orderId, changed: l.changed, status: l.status })),
      unknownCodes,
      customerCreated,
      emailsSent,
      emailErrors,
    }
  } catch (e) {
    await repo.finishEvent(eventId, { keyValid: true, outcome: 'erro', error: errorMessage(e), ...summary })
    throw e
  }
}
