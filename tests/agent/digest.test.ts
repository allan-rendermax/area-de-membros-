import { describe, expect, it } from 'vitest'
import { buildDigest } from '@/lib/agent/digest'

const metrics = {
  conversas: 12, resolvidas: 8, reenvios: 4,
  escalacoes: { reembolso: 3, 'dúvida técnica': 1 },
  novas: [{ id: '00000000-0000-4000-8000-000000000001', rule: 'É digital <PDF> & chega por e-mail' }],
  repetidas: ['reembolso: 3x'],
}

describe('resumo semanal', () => {
  it('resumo lista escalações por motivo e entradas novas com botão', () => {
    const result = buildDigest(metrics)
    for (const text of ['📊 Resumo semanal do agente', 'Conversas: <b>12</b>', 'Resolvidas: <b>8</b>', 'Reenvios: <b>4</b>', 'reembolso: 3', 'dúvida técnica: 1', 'reembolso: 3x', 'Aprendi esta semana:', '1. É digital &lt;PDF&gt; &amp; chega por e-mail']) {
      expect(result.text).toContain(text)
    }
    expect(result.buttons).toEqual([[{ text: 'Desativar 1', callback_data: 'agk:off:00000000-0000-4000-8000-000000000001' }]])
  })

  it('sem novas regras não gera botões', () => {
    const result = buildDigest({ conversas: 0, resolvidas: 0, reenvios: 0, escalacoes: {}, novas: [], repetidas: [] })
    expect(result.buttons).toEqual([])
    expect(result.text).toContain('Conversas: <b>0</b>')
    expect(result.text).toContain('Nenhuma regra nova')
  })

  it('escapa motivos e limita a dez regras mantendo números e callbacks correspondentes', () => {
    const result = buildDigest({ ...metrics, escalacoes: { '<motivo>&': 3 }, repetidas: ['<motivo>&: 3x'], novas: Array.from({ length: 12 }, (_, i) => ({ id: `rule-${i}`, rule: `Regra ${i}` })) })
    expect(result.text).toContain('&lt;motivo&gt;&amp;: 3')
    expect(result.text).toContain('&lt;motivo&gt;&amp;: 3x')
    expect(result.text).toContain('10. Regra 9')
    expect(result.text).not.toContain('Regra 10')
    expect(result.buttons).toHaveLength(10)
    expect(result.buttons[9]).toEqual([{ text: 'Desativar 10', callback_data: 'agk:off:rule-9' }])
  })

  it('mantém o HTML inteiro e o texto abaixo de 3500 caracteres com regras e motivos extensos', () => {
    const result = buildDigest({ ...metrics,
      escalacoes: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`${i} <&>`.repeat(100), 10])),
      repetidas: Array.from({ length: 100 }, () => '<&>'.repeat(100)),
      novas: Array.from({ length: 12 }, (_, i) => ({ id: `rule-${i}`, rule: '<&>💛'.repeat(1000) })),
    })
    expect(result.text.length).toBeLessThan(3500)
    expect(result.buttons).toHaveLength(10)
    expect(result.text).toContain('10. ')
    expect(result.text.match(/<b>/g)?.length).toBe(result.text.match(/<\/b>/g)?.length)
    expect(result.text.replace(/&(amp|lt|gt);/g, '')).not.toContain('&')
    expect(result.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u)
  })
})
