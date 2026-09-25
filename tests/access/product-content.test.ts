import { describe, expect, it } from 'vitest'
import { canAccessProductModule, sectionTitle } from '@/lib/access/product-content'

describe('versões de produto', () => {
  it('isola Básico e Completo, sem conceder upgrade', () => {
    expect(canAccessProductModule('complete', 'basic', 'versions')).toBe(false)
    expect(canAccessProductModule('complete', 'complete', 'versions')).toBe(true)
    expect(canAccessProductModule('basic', 'basic', 'versions')).toBe(true)
    expect(canAccessProductModule('basic', 'complete', 'versions')).toBe(false)
    expect(canAccessProductModule(undefined, 'basic', 'versions')).toBe(false)
  })
  it('preserva seções e libera ambos na prévia autorizada', () => {
    expect(canAccessProductModule('complete', 'basic', 'sections')).toBe(true)
    expect(canAccessProductModule('complete', 'basic', undefined)).toBe(true)
    expect(canAccessProductModule('basic', 'complete', 'versions', true)).toBe(true)
  })
  it('usa o nível salvo para nomes genéricos e preserva personalização', () => {
    expect(sectionTitle('Clique Aqui para acessar seu Atlas', 'basic', 'versions')).toBe('Básico')
    expect(sectionTitle('Materiais', 'complete', 'versions')).toBe('Completo')
    expect(sectionTitle('Bônus especiais', 'complete', 'versions')).toBe('Bônus especiais')
    expect(sectionTitle('Clique Aqui', 'basic', 'sections')).toBe('Materiais')
  })
})
