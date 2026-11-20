import { describe, expect, it } from 'vitest'
import { LAST_CHANCE_RULES, accessSignature, isLastChanceEligible, accessUrlFor, isValidAccessSignature, lastChanceTarget } from '@/lib/membros/last-chance'
import { protectedStoreSlug } from '@/lib/membros/paths'

const rule = LAST_CHANCE_RULES.arquitetura
const outro = { offerUrl: 'https://outro.test/oferta', eligibleCodes: ['ZZZ111'], skipCodes: ['45E268'] }
const login = 'https://app.test/arquitetura/entrar?email=joao%40gmail.com'

describe('lastChanceTarget', () => {
  it('manda quem comprou Patologias e não tem Arq Black para a oferta, levando o login junto', () => {
    expect(lastChanceTarget(rule, ['LGADK6'], login)).toBe(
      `https://patologias.casadoconhecimento.online/ultima-oportunidade?next=${encodeURIComponent(login)}`,
    )
    expect(lastChanceTarget(rule, ['45WX6J'], login)).not.toBeNull()
  })

  it('pula a oferta para quem já tem qualquer Arq Black', () => {
    expect(lastChanceTarget(rule, ['LGADK6', '45E268'], login)).toBeNull()
    expect(lastChanceTarget(rule, ['LGADK6', 'LX365X'], login)).toBeNull()
  })

  it('pula a oferta para quem não comprou produto elegível ou para loja sem regra', () => {
    expect(lastChanceTarget(rule, ['ZZZ999'], login)).toBeNull()
    expect(lastChanceTarget(rule, [], login)).toBeNull()
    expect(lastChanceTarget(undefined, ['LGADK6'], login)).toBeNull()
  })
})

describe('accessUrlFor e assinatura', () => {
  it('monta o link de acesso com e-mail e assinatura', () => {
    const sig = accessSignature('s3gredo', 'arquitetura', 'joao@gmail.com')
    expect(sig).toMatch(/^[0-9a-f]{32}$/)
    expect(accessUrlFor('https://app.test/', 'arquitetura', 'joao@gmail.com', 's3gredo')).toBe(
      `https://app.test/arquitetura/acesso?email=joao%40gmail.com&sig=${sig}`,
    )
  })

  it('só aceita a assinatura do mesmo segredo, loja e e-mail', () => {
    const sig = accessSignature('s3gredo', 'arquitetura', 'joao@gmail.com')
    expect(isValidAccessSignature('s3gredo', 'arquitetura', 'joao@gmail.com', sig)).toBe(true)
    expect(isValidAccessSignature('s3gredo', 'arquitetura', 'maria@gmail.com', sig)).toBe(false)
    expect(isValidAccessSignature('outro', 'arquitetura', 'joao@gmail.com', sig)).toBe(false)
    expect(isValidAccessSignature('s3gredo', 'arquitetura', 'joao@gmail.com', '')).toBe(false)
    expect(isValidAccessSignature('s3gredo', 'arquitetura', 'joao@gmail.com', 'x'.repeat(32))).toBe(false)
  })
})

describe('rota de acesso', () => {
  it('não exige login (quem chega do e-mail ainda não entrou)', () => {
    expect(protectedStoreSlug('/arquitetura/acesso')).toBeNull()
  })
})

describe('isLastChanceEligible', () => {
  it('segue a mesma regra da rota', () => {
    expect(isLastChanceEligible(rule, ['LGADK6'])).toBe(true)
    expect(isLastChanceEligible(rule, ['LGADK6', '45E268'])).toBe(false)
    expect(isLastChanceEligible(rule, ['ZZZ999'])).toBe(false)
    expect(isLastChanceEligible(undefined, ['LGADK6'])).toBe(false)
  })
})

describe('várias regras por loja', () => {
  it('cada Atlas leva para a sua página', () => {
    const rules = [...rule, outro]
    expect(lastChanceTarget(rules, ['ZZZ111'], login)).toBe(`https://outro.test/oferta?next=${encodeURIComponent(login)}`)
    expect(lastChanceTarget(rules, ['LGADK6'], login)).toContain('patologias.casadoconhecimento.online')
    expect(lastChanceTarget(rules, ['LGADK6', 'ZZZ111'], login)).toContain('patologias.casadoconhecimento.online')
    expect(lastChanceTarget(rules, ['ZZZ111', '45E268'], login)).toBeNull()
  })
})

describe('Hospitalar e Paisagismo', () => {
  it('cada um leva para a sua página e quem tem Arq Black pula', () => {
    expect(lastChanceTarget(rule, ['4OB2DZ'], login)).toContain('hospitalar.casadoconhecimento.online/ultima-oportunidade')
    expect(lastChanceTarget(rule, ['R2D9O3'], login)).toContain('paisagismo.casadoconhecimento.online/ultima-oportunidade')
    expect(lastChanceTarget(rule, ['4OB2DZ', 'LX365X'], login)).toBeNull()
    expect(lastChanceTarget(rule, ['R2D9O3', '4Z3GZM'], login)).toBeNull()
  })
})
