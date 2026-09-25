import { describe, it, expect } from 'vitest'
import { previewContext, previewIncludesDrafts, previewAccessLevel } from '@/lib/membros/preview-context'
import { withPreview } from '@/lib/membros/paths'

describe('administrative simulation context', () => {
  it('ignores simulation without explicit admin preview', () => {
    expect(previewContext({simular:'complete'})).toBe(false)
  })
  it('preserves editorial backwards compatibility', () => {
    expect(previewContext({previa:'1'})).toBe('editorial')
    expect(previewIncludesDrafts(true)).toBe(true)
    expect(previewIncludesDrafts('basic')).toBe(false)
  })
  it('separates simulated grants from draft access', () => {
    expect(previewAccessLevel('basic')).toBe('basic')
    expect(previewAccessLevel('complete')).toBe('complete')
    expect(previewAccessLevel('locked')).toBeUndefined()
  })
  it('carries simulation through query and anchor links', () => {
    expect(withPreview('/arquitetura?comprar=atlas#materiais','locked')).toBe('/arquitetura?comprar=atlas&previa=1&simular=locked#materiais')
    expect(withPreview('/arquitetura','editorial')).toBe('/arquitetura?previa=1')
  })
})
