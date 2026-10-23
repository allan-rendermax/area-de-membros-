import { z } from 'zod'
import { normalizeCheckoutUrl, normalizeUpsellCode } from './checkout'
import { normalizeEmail } from '@/lib/domain/email'

export type PaytProductLine = { code: string; name: string; amountCents: number | null; checkoutUrl?: string; upsellCode?: string; identifierInvalid?: boolean }

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
  link: z.unknown().optional(),
  upsell_code: z.unknown().optional(),
})

function firstNonEmptyCode(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') continue
    const code = String(value).trim()
    if (code) return code
  }
}

function identifiers(value: Record<string, unknown>): Pick<PaytProductLine, 'checkoutUrl' | 'upsellCode' | 'identifierInvalid'> {
  const rawUrl = value.link && typeof value.link === 'object' ? (value.link as Record<string, unknown>).url : undefined
  const checkoutUrl = normalizeCheckoutUrl(rawUrl)
  const upsellCode = normalizeUpsellCode(value.upsell_code)
  return {
    ...(checkoutUrl ? { checkoutUrl } : {}),
    ...(upsellCode ? { upsellCode } : {}),
    ...((rawUrl != null && !checkoutUrl) || (value.upsell_code != null && !upsellCode) ? { identifierInvalid: true } : {}),
  }
}

function lineFrom(value: unknown): PaytProductLine | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const code = firstNonEmptyCode(v.code, v.sku, v.id)
  if (!code) return null
  return {
    code,
    name: typeof v.name === 'string' ? v.name : '',
    amountCents: typeof v.price === 'number' ? v.price : null,
    ...identifiers(v),
  }
}

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

export function parsePaytPostback(body: unknown): { ok: true; value: PaytPostback } | { ok: false; error: string } {
  const parsed = schema.safeParse(body)
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) }

  const data = parsed.data
  const mainCode = firstNonEmptyCode(data.product.code, data.product.sku)
  if (!mainCode) return { ok: false, error: 'produto sem code/sku' }

  const candidates: PaytProductLine[] = [
    { code: mainCode, name: data.product.name ?? '', amountCents: data.product.price ?? null, ...identifiers(data) },
    ...[...asList(data.product.items), ...asList(data.order_bumps)]
      .map(lineFrom)
      .filter((line): line is PaytProductLine => line !== null),
  ]
  const seen = new Map<string, PaytProductLine>()
  for (const line of candidates) {
    const previous = seen.get(line.code)
    if (previous && (previous.checkoutUrl !== line.checkoutUrl || previous.upsellCode !== line.upsellCode || previous.identifierInvalid !== line.identifierInvalid)) {
      return { ok: false, error: `identificadores conflitantes para o produto ${line.code}` }
    }
    if (!previous) seen.set(line.code, line)
  }
  const products = [...seen.values()]

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
