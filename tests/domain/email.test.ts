import { describe, expect, it } from 'vitest'
import { isValidEmail, normalizeEmail } from '@/lib/domain/email'

describe('normalizeEmail', () => {
  it('remove espaços e passa para minúsculas', () => {
    expect(normalizeEmail('  Joao.Silva@Gmail.COM ')).toBe('joao.silva@gmail.com')
  })
})

describe('isValidEmail', () => {
  it('aceita email comum', () => {
    expect(isValidEmail('joao@gmail.com')).toBe(true)
  })
  it('recusa texto sem arroba ou domínio', () => {
    expect(isValidEmail('joao')).toBe(false)
    expect(isValidEmail('joao@gmail')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})
