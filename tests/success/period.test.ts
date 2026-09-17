import { describe, expect, it } from 'vitest'
import { parsePage, parsePeriod, periodWindow } from '@/lib/success/period'

describe('period', () => {
  it('aceita 7, 30 e 90 dias e usa 30 como padrão', () => {
    expect(parsePeriod('7')).toBe(7)
    expect(parsePeriod('90')).toBe(90)
    expect(parsePeriod('15')).toBe(30)
    expect(parsePeriod(undefined)).toBe(30)
  })

  it('calcula o início da janela', () => {
    const now = new Date('2026-09-17T12:00:00Z')
    expect(periodWindow(7, now)).toEqual({ now, sinceIso: '2026-09-10T12:00:00.000Z' })
  })
})

describe('parsePage', () => {
  it.each(['Infinity', '0.5', '-1', 'abc', undefined, '', ' 2', '2 ', '2e0', 2, null, ['2']].map((value) => ({ value })))(
    'usa zero para entrada inválida: %j',
    ({ value }) => expect(parsePage(value, 120, 50)).toBe(0),
  )

  it('aceita uma página válida', () => {
    expect(parsePage('2', 120, 50)).toBe(2)
  })

  it.each(['9', '999999999999999999999', '9'.repeat(400)])('limita à última página: %s', (value) => {
    expect(parsePage(value, 120, 50)).toBe(2)
  })

  it.each(['0', '2', '9', '9'.repeat(400), 'Infinity', '0.5', '-1', 'abc', undefined, null, 2, ['2']].map((value) => ({ value })))(
    'usa zero quando não há itens: %j',
    ({ value }) => expect(parsePage(value, 0, 50)).toBe(0),
  )

  it('não cria uma página extra quando o total é múltiplo do tamanho', () => {
    expect(parsePage('9', 100, 50)).toBe(1)
    expect(parsePage('9', 50, 50)).toBe(0)
  })
})
