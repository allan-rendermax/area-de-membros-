import { z } from 'zod'
import { normalizeEmail } from '@/lib/domain/email'

export type PaytProductLine = { code: string; name: string; amountCents: number | null }

export type PaytPostback = {
  transactionId: string
  status: string
  type: string
  isTest: boolean
  customerEmail: string
  customerName: string
  products: PaytProductLine[]
}

const idLike = z.union([z.string(), z.number()]).transform(String)

const schema = z.object({
  transaction_id: idLike,
  status: z.string(),
  type: z.string().optional(),
  test: z.union([z.boolean(), z.string(), z.number()]).optional(),
  customer: z.object({
    name: z.string().optional(),
    email: z.string().transform(normalizeEmail).pipe(z.email()),
  }),
  product: z.object({
    name: z.string().optional(),
    code: idLike.optional(),
    sku: idLike.optional(),
    price: z.number().optional(),
    items: z.unknown().optional(),
  }),
  order_bumps: z.unknown().optional(),
})

function lineFrom(value: unknown): PaytProductLine | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const raw = v.code ?? v.sku ?? v.id
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const code = String(raw).trim()
  if (!code) return null
  return {
    code,
    name: typeof v.name === 'string' ? v.name : '',
    amountCents: typeof v.price === 'number' ? v.price : null,
  }
}

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

export function parsePaytPostback(body: unknown): { ok: true; value: PaytPostback } | { ok: false; error: string } {
  const parsed = schema.safeParse(body)
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) }

  const data = parsed.data
  const mainCode = (data.product.code ?? data.product.sku)?.trim()
  if (!mainCode) return { ok: false, error: 'produto sem code/sku' }

  const candidates: PaytProductLine[] = [
    { code: mainCode, name: data.product.name ?? '', amountCents: data.product.price ?? null },
    ...[...asList(data.product.items), ...asList(data.order_bumps)]
      .map(lineFrom)
      .filter((line): line is PaytProductLine => line !== null),
  ]
  const seen = new Set<string>()
  const products = candidates.filter((line) => (seen.has(line.code) ? false : (seen.add(line.code), true)))

  return {
    ok: true,
    value: {
      transactionId: data.transaction_id,
      status: data.status,
      type: data.type ?? 'order',
      isTest: data.test === true || data.test === 'true' || data.test === 1 || data.test === '1',
      customerEmail: data.customer.email,
      customerName: data.customer.name?.trim() ?? '',
      products,
    },
  }
}
