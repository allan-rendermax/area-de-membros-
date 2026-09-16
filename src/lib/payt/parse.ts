import { z } from 'zod'
import { normalizeEmail } from '@/lib/domain/email'

export type PaytPostback = {
  transactionId: string
  status: string
  type: string
  isTest: boolean
  customerEmail: string
  customerName: string
  productCode: string
  productName: string
  amountCents: number | null
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
  }),
})

export function parsePaytPostback(
  body: unknown,
): { ok: true; value: PaytPostback } | { ok: false; error: string } {
  const parsed = schema.safeParse(body)
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) }

  const data = parsed.data
  const productCode = data.product.code ?? data.product.sku
  if (!productCode) return { ok: false, error: 'produto sem code/sku' }

  return {
    ok: true,
    value: {
      transactionId: data.transaction_id,
      status: data.status,
      type: data.type ?? 'order',
      isTest: data.test === true || data.test === 'true' || data.test === 1 || data.test === '1',
      customerEmail: data.customer.email,
      customerName: data.customer.name?.trim() ?? '',
      productCode,
      productName: data.product.name ?? '',
      amountCents: data.product.price ?? null,
    },
  }
}
