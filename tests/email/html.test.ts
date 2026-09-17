import { describe, expect, it } from 'vitest'
import { escapeHtml } from '@/lib/email/html'

describe('escapeHtml', () => {
  it('escapa caracteres especiais', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;')
  })
})
