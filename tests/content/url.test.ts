import { describe, expect, it } from 'vitest'
import { isHttpUrl, isUuid } from '@/lib/content/url'

describe('url', () => {
  it('aceita só http e https', () => {
    expect(isHttpUrl('https://drive.google.com/file/d/1')).toBe(true)
    expect(isHttpUrl('http://exemplo.com')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('ftp://x.com')).toBe(false)
    expect(isHttpUrl('sem url')).toBe(false)
  })

  it('reconhece uuid', () => {
    expect(isUuid('0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c')).toBe(true)
    expect(isUuid('123')).toBe(false)
  })
})
