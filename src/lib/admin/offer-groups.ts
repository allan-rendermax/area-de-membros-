import { z } from 'zod'
import { FormError } from './forms'
import { normalizeCheckoutUrl, normalizeUpsellCode } from '@/lib/payt/checkout'

const uuid = z.string().uuid('Registro inválido.')
const planSchema = z.object({
  id: uuid.nullable(),
  name: z.string().trim().min(1, 'Informe o nome de cada plano.'),
  paytProductCode: z.string().trim().min(1, 'Informe o ID Payt de cada plano.').regex(/^\S+$/, 'Informe o ID Payt sem espaços.'),
  matchType: z.enum(['product', 'checkout', 'upsell']).default('product'),
  checkoutCode: z.string().trim().nullable().optional().transform(value => value || null),
  matchValues: z.array(z.string()).default([]),
  grants: z.array(z.object({
    productId: uuid,
    level: z.enum(['basic', 'complete'], { error: 'Nível inválido: use Básico ou Completo.' }),
  })).min(1, 'Selecione ao menos um produto para cada plano.')
    .refine(grants => new Set(grants.map(g => g.productId)).size === grants.length, 'Produto repetido no plano.'),
}).transform((plan, ctx) => {
  const normalize = plan.matchType === 'checkout' ? normalizeCheckoutUrl : normalizeUpsellCode
  const values = plan.matchValues.map(normalize)
  if (plan.matchType === 'product' ? values.length > 0 : !values.length || values.some(value => !value)) {
    ctx.addIssue({ code: 'custom', message: plan.matchType === 'checkout' ? 'Informe links HTTPS válidos da Payt para identificar o plano.' : 'Revise os identificadores do plano: produto não usa aliases; upsell exige códigos sem espaços.' })
  }
  return { ...plan, matchValues: [...new Set(values.filter((value): value is string => Boolean(value)))] }
})
const plansSchema = z.array(planSchema).min(1, 'Adicione ao menos um plano.')
  .refine(plans => plans.every((plan, index) => plans.slice(index + 1).every(other =>
    plan.paytProductCode !== other.paytProductCode || (plan.matchType !== 'product' && other.matchType !== 'product' &&
      (plan.matchType !== other.matchType || !plan.matchValues.some(value => other.matchValues.includes(value))))
  )), 'Planos com o mesmo ID Payt exigem identificação por checkout ou upsell sem aliases sobrepostos.')
  .refine(plans => {
    const ids = plans.flatMap(p => p.id ? [p.id] : [])
    return new Set(ids).size === ids.length
  }, 'Plano repetido na oferta.')

export type OfferPlanInput = z.input<typeof planSchema>
export type OfferGroupInput = { id: string | null; storeId: string; name: string; version: number; plans: OfferPlanInput[] }

export function parseOfferGroupForm(form: FormData, storeId: string): OfferGroupInput {
  const id = String(form.get('id') ?? '').trim() || null
  if (id && !uuid.safeParse(id).success) throw new FormError('Oferta inválida.')
  const name = String(form.get('name') ?? '').trim()
  if (!name) throw new FormError('Informe o nome da oferta.')
  const version = Number(form.get('version'))
  if (!Number.isInteger(version) || version < (id ? 1 : 0)) throw new FormError('Versão inválida. Recarregue a oferta.')
  let raw: unknown
  try { raw = JSON.parse(String(form.get('plans') ?? '')) } catch { throw new FormError('Planos inválidos. Revise o formulário.') }
  const result = plansSchema.safeParse(raw)
  if (!result.success) throw new FormError(result.error.issues[0].message)
  if (!id && result.data.some(p => p.id)) throw new FormError('Uma nova oferta só pode conter planos novos.')
  return { id, storeId, name, version, plans: result.data }
}
