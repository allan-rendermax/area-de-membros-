import { describe, expect, it } from 'vitest'
import { moveInList } from '@/lib/admin/order'

describe('moveInList', () => {
  it('sobe e desce um item', () => {
    expect(moveInList(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c'])
    expect(moveInList(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b'])
  })

  it('não mexe nas pontas nem em id desconhecido', () => {
    expect(moveInList(['a', 'b'], 'a', 'up')).toEqual(['a', 'b'])
    expect(moveInList(['a', 'b'], 'b', 'down')).toEqual(['a', 'b'])
    expect(moveInList(['a', 'b'], 'x', 'up')).toEqual(['a', 'b'])
  })
})
