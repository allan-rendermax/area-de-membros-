import { describe, expect, it } from 'vitest'
import { normalizeWhatsapp, supportHref, supportMessage } from '@/lib/support/whatsapp'

const store = { name: 'Arquitetura', supportWhatsapp: '+55 (11) 99999-8888', supportUrl: 'https://ajuda.exemplo.com' }

describe('whatsapp', () => {
  it('normaliza o número', () => {
    expect(normalizeWhatsapp('+55 (11) 99999-8888')).toBe('5511999998888')
    expect(normalizeWhatsapp('1234')).toBeNull()
  })

  it('monta a mensagem de e-mail não encontrado', () => {
    expect(supportMessage('nao_encontrado', 'Arquitetura', 'joao@gmail.com')).toBe(
      'Olá! Comprei um produto da Arquitetura com o e-mail joao@gmail.com e não estou conseguindo acessar.',
    )
    expect(supportMessage('nao_encontrado', 'Arquitetura')).toBe('Olá! Comprei um produto da Arquitetura e não estou conseguindo acessar.')
  })

  it('monta a mensagem geral', () => {
    expect(supportMessage('geral', 'Arquitetura', 'joao@gmail.com')).toBe(
      'Olá! Preciso de ajuda com a área de membros da Arquitetura. Meu e-mail é joao@gmail.com.',
    )
  })

  it('usa WhatsApp quando há número, senão o link de suporte, senão nada', () => {
    expect(supportHref(store, 'nao_encontrado', 'joao@gmail.com')).toBe(
      `https://wa.me/5511999998888?text=${encodeURIComponent('Olá! Comprei um produto da Arquitetura com o e-mail joao@gmail.com e não estou conseguindo acessar.')}`,
    )
    expect(supportHref({ ...store, supportWhatsapp: null }, 'geral')).toBe('https://ajuda.exemplo.com')
    expect(supportHref({ ...store, supportWhatsapp: null, supportUrl: null }, 'geral')).toBeNull()
  })
})
