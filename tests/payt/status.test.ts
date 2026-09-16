import { describe, expect, it } from 'vitest'
import { canTransition, mapPaytStatus } from '@/lib/payt/status'

describe('mapPaytStatus', () => {
  it('traduz status conhecidos', () => {
    expect(mapPaytStatus('waiting_payment')).toBe('pendente')
    expect(mapPaytStatus('paid')).toBe('pago')
    expect(mapPaytStatus('canceled')).toBe('cancelado')
    expect(mapPaytStatus('refunded')).toBe('reembolsado')
    expect(mapPaytStatus('chargeback')).toBe('chargeback')
  })
  it('ignora maiúsculas e espaços', () => {
    expect(mapPaytStatus(' PAID ')).toBe('pago')
  })
  it('retorna null para status que não afetam acesso', () => {
    expect(mapPaytStatus('lost_cart')).toBeNull()
    expect(mapPaytStatus('subscription_renewed')).toBeNull()
  })
})

describe('canTransition', () => {
  it('permite qualquer status em pedido novo', () => {
    expect(canTransition(null, 'pendente')).toBe(true)
    expect(canTransition(null, 'reembolsado')).toBe(true)
  })
  it('só avança de nível', () => {
    expect(canTransition('pendente', 'pago')).toBe(true)
    expect(canTransition('pago', 'reembolsado')).toBe(true)
    expect(canTransition('pago', 'pendente')).toBe(false)
    expect(canTransition('reembolsado', 'pago')).toBe(false)
    expect(canTransition('pago', 'pago')).toBe(false)
    expect(canTransition('cancelado', 'chargeback')).toBe(false)
  })
})
