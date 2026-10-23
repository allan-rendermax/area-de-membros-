import { describe, expect, it } from 'vitest'
import { parseOfferGroupForm } from '@/lib/admin/offer-groups'
import { lerFicha, montarPlano } from '../../scripts/lib/cadastro-plano.mjs'
import { validarLote } from '../../scripts/lib/cadastro-executor.mjs'

const productId = '00000000-0000-4000-8000-000000000101'
const plan = (alias: string, mode = 'checkout') => ({ id: null, name: alias, paytProductCode: 'SHARED', matchType: mode, checkoutCode: alias, matchValues: [alias], grants: [{ productId, level: 'basic' }] })
function parse(plans: unknown[]) {
  const form = new FormData()
  for (const [key, value] of Object.entries({ name: 'Kit', version: '0', plans: JSON.stringify(plans) })) form.set(key, value)
  return parseOfferGroupForm(form, productId)
}
const ficha = 'nome: Kit\nproduto_payt: SHARED\ncodigo_checkout_basico: B\nlinks_checkout_basico: https://payt.site/Basic?utm=x, https://checkout.payt.com.br/basic/\ncodigo_checkout_completo: C\nlinks_checkout_completo: https://payt.site/Full\ntag: front\nloja: arquitetura'

describe('configuração específica de planos', () => {
  it('aceita código compartilhado e normaliza aliases sem alterar case', () => {
    const parsed = parse([plan('https://PAYT.site/Basic/?utm=x'), plan('https://payt.site/Full')])
    expect(parsed.plans[0]).toMatchObject({ matchType: 'checkout', matchValues: ['https://payt.site/Basic'] })
  })
  it.each([
    [plan('https://payt.site/Basic'), plan('https://payt.site/Basic/?x=1')],
    [plan('https://payt.site/Basic'), { ...plan('B'), matchType: 'product', matchValues: [] }],
    [{ ...plan('B'), matchValues: [] }], [plan('https://evil.test/checkout')],
    [plan('UP SELL', 'upsell')],
  ])('recusa sobreposição, mistura e identificadores inválidos', (...plans) => expect(() => parse(plans)).toThrow())
  it('mantém modo product em dados legados', () => {
    const legacy = { id: null, name: 'Legado', paytProductCode: 'OLD', grants: [{ productId, level: 'basic' }] }
    expect(parse([legacy]).plans[0]).toMatchObject({ matchType: 'product', checkoutCode: null, matchValues: [] })
  })
  it('lê campos explícitos compartilhados sem exigir botão de upgrade', () => {
    const parsed = lerFicha(ficha)
    expect(parsed).toMatchObject({ modoNiveis: true, checkoutUpgrade: null, ofertas: [
      { codigo: 'SHARED', nivel: 'basic', matchType: 'checkout', checkoutCode: 'B', matchValues: ['https://payt.site/Basic', 'https://checkout.payt.com.br/basic'] },
      { codigo: 'SHARED', nivel: 'complete', matchType: 'checkout', checkoutCode: 'C', matchValues: ['https://payt.site/Full'] },
    ] })
    expect(() => validarLote([montarPlano({ ficha: parsed, arquivos: [] })])).not.toThrow()
  })
  it.each([
    ficha + '\nid_basico: OLD', ficha.replace('https://payt.site/Full', 'https://payt.site/Basic'),
    ficha.replace('links_checkout_completo: https://payt.site/Full', ''),
    ficha.replace('https://payt.site/Full', 'https://evil.test/a'),
    ficha.replace('codigo_checkout_completo: C', 'codigo_checkout_completo: B'),
  ])('recusa ficha incompleta ou ambígua antes de rede', text => expect(() => lerFicha(text)).toThrow())
  it('não permite compartilhar código entre produtos do lote', () => {
    const first = montarPlano({ ficha: lerFicha(ficha), arquivos: [] })
    const other = montarPlano({ ficha: lerFicha(ficha.replace('nome: Kit', 'nome: Outro')), arquivos: [] })
    expect(() => validarLote([first, other])).toThrow(/Payt.*repetid|repetid.*Payt/i)
  })
})
