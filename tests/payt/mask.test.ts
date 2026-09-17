import { describe, expect, it } from 'vitest'
import { maskPayload } from '@/lib/payt/mask'

describe('maskPayload', () => {
  it('esconde a chave de integração em qualquer nível sem mexer no resto', () => {
    const payload = { integration_key: 'segredo', status: 'paid', data: { integration_key: 'outro', itens: [{ integration_key: 'x', code: 'A' }] } }
    expect(maskPayload(payload)).toEqual({ integration_key: '••••', status: 'paid', data: { integration_key: '••••', itens: [{ integration_key: '••••', code: 'A' }] } })
    expect(payload.integration_key).toBe('segredo')
  })

  it('aceita valores simples', () => {
    expect(maskPayload('texto')).toBe('texto')
    expect(maskPayload(null)).toBeNull()
  })
})
