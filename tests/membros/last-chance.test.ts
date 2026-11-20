import { describe, expect, it } from 'vitest'
import { LAST_CHANCE_RULES, accessUrlFor, lastChanceTarget } from '@/lib/membros/last-chance'
import { protectedStoreSlug } from '@/lib/membros/paths'

const rule = LAST_CHANCE_RULES.arquitetura
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
    expect(lastChanceTarget(rule, ['4OB2DZ'], login)).toBeNull()
    expect(lastChanceTarget(rule, [], login)).toBeNull()
    expect(lastChanceTarget(undefined, ['LGADK6'], login)).toBeNull()
  })
})

describe('accessUrlFor', () => {
  it('monta o link de acesso da loja com o e-mail', () => {
    expect(accessUrlFor('https://app.test/', 'arquitetura', 'joao@gmail.com')).toBe(
      'https://app.test/arquitetura/acesso?email=joao%40gmail.com',
    )
  })
})

describe('rota de acesso', () => {
  it('não exige login (quem chega do e-mail ainda não entrou)', () => {
    expect(protectedStoreSlug('/arquitetura/acesso')).toBeNull()
  })
})
