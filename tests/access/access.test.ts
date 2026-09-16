import { describe, expect, it } from 'vitest'
import { buildVitrine, grantedMaterialIds } from '@/lib/access/access'
import type { Material, OfferLink } from '@/lib/domain/types'

const links: OfferLink[] = [
  { productCode: 'BASICO', materialId: 'atlas' },
  { productCode: 'COMPLETO', materialId: 'atlas' },
  { productCode: 'COMPLETO', materialId: 'bonus1' },
  { productCode: 'COMPLETO', materialId: 'bonus2' },
  { productCode: 'BUMP', materialId: 'checklist' },
]

function material(id: string, sortOrder: number, extra: Partial<Material> = {}): Material {
  return {
    id, title: id, description: '', coverUrl: null,
    downloadUrl: `https://drive/${id}`, checkoutUrl: `https://payt/${id}`,
    sortOrder, isPublished: true, ...extra,
  }
}

describe('grantedMaterialIds', () => {
  it('libera os materiais das ofertas pagas', () => {
    const ids = grantedMaterialIds([{ productCode: 'COMPLETO', status: 'pago' }], links, false)
    expect([...ids].sort()).toEqual(['atlas', 'bonus1', 'bonus2'])
  })

  it('pedido pendente, cancelado, reembolsado ou chargeback não libera', () => {
    for (const status of ['pendente', 'cancelado', 'reembolsado', 'chargeback'] as const) {
      expect(grantedMaterialIds([{ productCode: 'BASICO', status }], links, false).size).toBe(0)
    }
  })

  it('reembolso de uma oferta mantém material liberado por outra', () => {
    const ids = grantedMaterialIds(
      [
        { productCode: 'BASICO', status: 'reembolsado' },
        { productCode: 'COMPLETO', status: 'pago' },
      ],
      links,
      false,
    )
    expect(ids.has('atlas')).toBe(true)
  })

  it('bump reembolsado com plano mantido remove só o bump', () => {
    const ids = grantedMaterialIds(
      [
        { productCode: 'BASICO', status: 'pago' },
        { productCode: 'BUMP', status: 'reembolsado' },
      ],
      links,
      false,
    )
    expect([...ids]).toEqual(['atlas'])
  })

  it('oferta desconhecida passa a liberar quando cadastrada', () => {
    const orders = [{ productCode: 'NOVO', status: 'pago' as const }]
    expect(grantedMaterialIds(orders, links, false).size).toBe(0)
    const withNew = [...links, { productCode: 'NOVO', materialId: 'pack' }]
    expect([...grantedMaterialIds(orders, withNew, false)]).toEqual(['pack'])
  })

  it('cliente bloqueado não tem acesso', () => {
    expect(grantedMaterialIds([{ productCode: 'COMPLETO', status: 'pago' }], links, true).size).toBe(0)
  })
})

describe('buildVitrine', () => {
  const materials = [material('bonus1', 2), material('atlas', 1), material('oculto', 0, { isPublished: false })]

  it('separa liberados e bloqueados, ordena e esconde não publicados', () => {
    const v = buildVitrine(materials, new Set(['atlas']))
    expect(v.unlocked.map((m) => m.id)).toEqual(['atlas'])
    expect(v.locked.map((m) => m.id)).toEqual(['bonus1'])
  })

  it('não expõe o link de download de material bloqueado', () => {
    const v = buildVitrine(materials, new Set())
    expect(JSON.stringify(v.locked)).not.toContain('https://drive/')
    expect(v.locked[0]).toMatchObject({ unlocked: false, checkoutUrl: 'https://payt/atlas' })
  })
})
