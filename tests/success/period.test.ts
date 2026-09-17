import { describe, expect, it } from 'vitest'
import { parsePeriod, periodWindow } from '@/lib/success/period'

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
