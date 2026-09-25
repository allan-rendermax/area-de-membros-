import { describe, expect, it } from 'vitest'
import { resolveResumeItem } from '@/lib/membros/resume-material'

describe('retomada do último material autorizado', () => {
  it.each([
    [['item-2', 'item-1'], ['item-1', 'item-2'], 'item-2'],
    [['complete-2', 'basic-1'], ['basic-1'], 'basic-1'],
    [['draft', 'removed', 'other-store'], ['basic-1'], null],
    [[], ['basic-1'], null],
    [['removed'], [], null],
  ])('resolve visitas %j com acesso %j', (items, allowed, expected) => {
    expect(resolveResumeItem(items.map((itemId) => ({ itemId })), new Set(allowed))).toBe(expected)
  })
})
