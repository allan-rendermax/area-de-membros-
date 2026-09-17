import { describe, expect, it } from 'vitest'
import { isReservedStoreSlug, isValidSlug, isValidStoreSlug, slugify } from '@/lib/content/slug'

describe('slug', () => {
  it('gera slug sem acentos e sem símbolos', () => {
    expect(slugify('Atlas Visual — Patologias da Construção!')).toBe('atlas-visual-patologias-da-construcao')
    expect(slugify('  --Olá  Mundo--  ')).toBe('ola-mundo')
  })

  it('limita o tamanho sem terminar em hífen', () => {
    const slug = slugify(`${'a'.repeat(59)} b`)
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('valida o formato', () => {
    expect(isValidSlug('arquitetura')).toBe(true)
    expect(isValidSlug('nutricao-animal-2')).toBe(true)
    expect(isValidSlug('Arquitetura')).toBe(false)
    expect(isValidSlug('a--b')).toBe(false)
    expect(isValidSlug('')).toBe(false)
  })

  it('recusa slugs reservados para loja', () => {
    for (const slug of ['admin', 'api', 'entrar', 'sair', 'icons']) {
      expect(isReservedStoreSlug(slug)).toBe(true)
      expect(isValidStoreSlug(slug)).toBe(false)
    }
    expect(isValidStoreSlug('estoicismo')).toBe(true)
  })
})
