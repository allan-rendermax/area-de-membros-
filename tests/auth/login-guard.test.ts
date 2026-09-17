import { describe, expect, it } from 'vitest'
import { checkFormStamp, freshFormStamp, GUARD, hashEmail, progressiveDelayMs, signFormStamp } from '@/lib/auth/login-guard'

const SECRET = 'segredo'

describe('carimbo do formulário', () => {
  it('aceita depois do tempo mínimo', () => {
    expect(checkFormStamp(signFormStamp(1_000_000, SECRET), 1_000_000 + GUARD.minFillMs, SECRET)).toBe('ok')
  })

  it('carimbo novo usa o horário atual', () => {
    expect(checkFormStamp(freshFormStamp(SECRET), Date.now() + GUARD.minFillMs, SECRET)).toBe('ok')
  })

  it('recusa envio rápido demais', () => {
    expect(checkFormStamp(signFormStamp(1_000_000, SECRET), 1_000_500, SECRET)).toBe('too_fast')
  })

  it('recusa carimbo adulterado, de outro segredo, vencido ou malformado', () => {
    const stamp = signFormStamp(1_000_000, SECRET)
    expect(checkFormStamp(stamp.replace('1000000', '999000'), 1_010_000, SECRET)).toBe('invalid')
    expect(checkFormStamp(signFormStamp(1_000_000, 'outro'), 1_010_000, SECRET)).toBe('invalid')
    expect(checkFormStamp(stamp, 1_000_000 + GUARD.maxFormAgeMs + 1, SECRET)).toBe('invalid')
    expect(checkFormStamp('', 1_010_000, SECRET)).toBe('invalid')
    expect(checkFormStamp('abc.def', 1_010_000, SECRET)).toBe('invalid')
  })
})

describe('hashEmail', () => {
  it('é estável e não contém o e-mail', () => {
    const hash = hashEmail('joao@gmail.com', SECRET)
    expect(hash).toBe(hashEmail('joao@gmail.com', SECRET))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('progressiveDelayMs', () => {
  it('começa na 3ª tentativa e tem teto', () => {
    expect(progressiveDelayMs(0)).toBe(0)
    expect(progressiveDelayMs(1)).toBe(0)
    expect(progressiveDelayMs(2)).toBe(700)
    expect(progressiveDelayMs(3)).toBe(1400)
    expect(progressiveDelayMs(10)).toBe(3000)
  })
})
