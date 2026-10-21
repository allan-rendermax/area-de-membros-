import { expect, it } from 'vitest'
import { lerFicha } from '../../scripts/lib/cadastro-plano.mjs'

const base = 'nome: Atlas\nid: CODE\ntag: front\nloja: arquitetura\nslug: atlas'

it('lê complemento opcional, aceita nenhum e rejeita slugs inválidos ou iguais ao produto', () => {
  expect(lerFicha(base)).not.toHaveProperty('complemento')
  expect(lerFicha(`${base}\ncomplemento: protocolo-anti-retrabalho`).complemento).toBe('protocolo-anti-retrabalho')
  expect(lerFicha(`${base}\ncomplemento: nenhum`).complemento).toBe('nenhum')
  expect(() => lerFicha(`${base}\ncomplemento: Outro Produto`)).toThrow(/complemento/i)
  expect(() => lerFicha(`${base}\ncomplemento: atlas`)).toThrow(/complemento/i)
})
