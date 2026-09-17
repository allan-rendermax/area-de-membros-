import { describe, expect, it } from 'vitest'
import { coverGradient } from '@/lib/content/cover'

describe('coverGradient', () => {
  it('é determinístico para o mesmo id', () => {
    expect(coverGradient('produto-1')).toBe(coverGradient('produto-1'))
  })

  it('gera um gradiente CSS', () => {
    expect(coverGradient('qualquer')).toMatch(/^linear-gradient\(160deg, #[0-9a-f]{6} 0%, #0b0b0c 85%\)$/)
  })

  it('varia entre ids diferentes', () => {
    const values = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(coverGradient))
    expect(values.size).toBeGreaterThan(1)
  })
})
