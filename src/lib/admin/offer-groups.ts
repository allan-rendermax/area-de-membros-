import { z } from 'zod'
import { FormError } from './forms'

const uuid = z.string().uuid('Registro inválido.')
const planSchema = z.object({
  id: uuid.nullable(),
  name: z.string().trim().min(1, 'Informe o nome de cada plano.'),
  paytProductCode: z.string().trim().min(1, 'Informe o ID Payt de cada plano.').regex(/^\S+$/, 'Informe o ID Payt sem espaços.'),
  grants: z.array(z.object({
    productId: uuid,
    level: z.enum(['basic', 'complete'], { error: 'Nível inválido: use Básico ou Completo.' }),
  })).min(1, 'Selecione ao menos um produto para cada plano.')
    .refine(grants => new Set(grants.map(g => g.productId)).size === grants.length, 'Produto repetido no plano.'),
})
const plansSchema = z.array(planSchema).min(1, 'Adicione ao menos um plano.')
  .refine(plans => new Set(plans.map(p => p.paytProductCode)).size === plans.length, 'Cada plano deve ter um ID Payt diferente.')
  .refine(plans => {
    const ids = plans.flatMap(p => p.id ? [p.id] : [])
    return new Set(ids).size === ids.length
  }, 'Plano repetido na oferta.')

export type OfferPlanInput = z.infer<typeof planSchema>
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
