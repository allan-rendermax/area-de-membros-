import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseOfferGroupForm } from '@/lib/admin/offer-groups'
import { getOfferGroup, saveOfferGroup } from '@/lib/data/offer-groups'

const store = '00000000-0000-4000-8000-000000000001'
const product = '00000000-0000-4000-8000-000000000101'
const id = '00000000-0000-4000-8000-000000000201'
const basic = { id: null, name: ' Básico ', paytProductCode: ' BASIC ', grants: [{ productId: product, level: 'basic' }] }
const complete = { ...basic, name: 'Completo', paytProductCode: 'COMPLETE', grants: [{ productId: product, level: 'complete' }] }
const io = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => io }))
beforeEach(() => vi.resetAllMocks())
function form(plans: unknown = [basic, complete], fields: Record<string, string> = {}) {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ name: ' Atlas ', id: '', version: '0', plans: JSON.stringify(plans), ...fields })) fd.set(k, v)
  return fd
}
describe('contrato de oferta com planos', () => {
  it('normaliza nomes/códigos e mantém liberações separadas', () => {
    expect(parseOfferGroupForm(form(), store)).toEqual({ id: null, storeId: store, name: 'Atlas', version: 0, plans: [
      { ...basic, name: 'Básico', paytProductCode: 'BASIC' }, complete,
    ] })
  })
  it.each([
    { plans: [] }, { plans: [basic, basic] }, { plans: [{ ...basic, grants: [] }] },
    { plans: [{ ...basic, grants: [{ productId: product, level: 'vip' }] }] },
    { plans: [{ ...basic, grants: [basic.grants[0], basic.grants[0]] }] },
    { plans: [{ ...basic, id: 'not-uuid' }] }, { plans: [{ ...basic, name: '' }] },
    { plans: [{ ...basic, paytProductCode: 'A B' }] },
    { plans: [{ ...basic, id }, { ...complete, id }] },
  ])('recusa planos inválidos $plans', ({ plans }) => {
    expect(() => parseOfferGroupForm(form(plans), store)).toThrow()
  })
  it('recusa JSON inválido e versão ausente em edição', () => {
    expect(() => parseOfferGroupForm(form([], { plans: '{' }), store)).toThrow(/planos/i)
    expect(() => parseOfferGroupForm(form([basic], { id, version: '' }), store)).toThrow(/versão/i)
  })
  it('envia um grupo inteiro à RPC com níveis exatos', async () => {
    io.rpc.mockResolvedValue({ data: id, error: null })
    await expect(saveOfferGroup(parseOfferGroupForm(form(), store))).resolves.toBe(id)
    expect(io.rpc).toHaveBeenCalledExactlyOnceWith('save_offer_group_atomic', {
      p_id: null, p_store_id: store, p_name: 'Atlas', p_version: 0, p_plans: [
        { id: null, name: 'Básico', payt_product_code: 'BASIC', grants: [{ product_id: product, grant_level: 'basic' }] },
        { id: null, name: 'Completo', payt_product_code: 'COMPLETE', grants: [{ product_id: product, grant_level: 'complete' }] },
      ],
    })
  })
  it.each([{ code: 'PGRST202', match: /migração/i }, { code: '23505', match: /código/i }, { code: 'P0001', match: /alterada/i }])('traduz erro $code em instrução útil', async ({ code, match }) => {
    io.rpc.mockResolvedValue({ data: null, error: { code, message: 'Oferta alterada' } })
    await expect(saveOfferGroup(parseOfferGroupForm(form(), store))).rejects.toThrow(match)
  })
  it('resolve endereço legado para grupo preservando plano e nível', async () => {
    const groupId = '00000000-0000-4000-8000-000000000301'
    const groupResult = { id: groupId, name: 'Atlas', version: 3, offers: [{ id, name: 'Básico', payt_product_code: 'BASIC', offer_products: [{ product_id: product, grant_level: 'basic' }] }] }
    const single = vi.fn().mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: { group_id: groupId }, error: null }).mockResolvedValueOnce({ data: groupResult, error: null })
    const eq = vi.fn()
    const query = { select: vi.fn(() => query), eq, maybeSingle: single }
    eq.mockReturnValue(query)
    io.from.mockReturnValue(query)
    await expect(getOfferGroup(id, store)).resolves.toEqual({ id: groupId, name: 'Atlas', version: 3, plans: [{ id, name: 'Básico', paytProductCode: 'BASIC', grants: [{ productId: product, level: 'basic' }] }] })
    expect(query.eq.mock.calls.filter(c => c[0] === 'store_id')).toEqual([['store_id', store], ['store_id', store], ['store_id', store]])
  })
})
