import { describe, expect, it } from 'vitest'
import { escapeHtml, html, orderLabel, deliveryEmoji, welcome } from '@/lib/telegram/format'
import { deliveryLabel } from '@/lib/telegram/client'

describe('formatação HTML', () => {
  it('escapa HTML sem interpretar conteúdo dinâmico', () => {
    expect(escapeHtml('<b>& cliente >')).toBe('&lt;b&gt;&amp; cliente &gt;')
    expect(html('😀<&'.repeat(200), 100).length).toBeLessThanOrEqual(100)
    expect(html('😀<&'.repeat(200), 100)).not.toMatch(/&(?!amp;|lt;|gt;)/)
  })
  it.each([
    ['delivered', '📬'], ['opened', '👀'], ['clicked', '🔗'], ['sent', '📤'],
    ['bounced', '🔴'], ['suppressed', '⛔'], ['complained', '🚫'], ['failed', '❌'],
    ['delivery_delayed', '⏳'], ['delayed', '⏳'], ['queued', '🕒'], ['scheduled', '🕒'], ['<unknown>', '❔'],
  ])('evento %s recebe emoji %s', (event, emoji) => {
    expect(deliveryEmoji(event)).toBe(emoji)
    expect(deliveryLabel(event).startsWith(emoji)).toBe(true)
  })
  it.each([['pago', '✅ Pago'], ['reembolsado', '↩️ Reembolsado'], ['pendente', '⏳ Pendente'], ['cancelado', '❌ Cancelado'], ['chargeback', '⚠️ Chargeback'], ['<&', '• &lt;&amp;']])('formata status %s', (status, expected) => {
    expect(orderLabel(status)).toBe(expected)
  })
  it('ajuda preserva aviso de confirmação e mostra equipe só ao proprietário', () => {
    expect(welcome()).toContain('Nada é enviado sem a sua confirmação.')
    expect(welcome()).not.toContain('/equipe')
    expect(welcome(true)).toBe(welcome() + ' · /equipe')
  })
})
