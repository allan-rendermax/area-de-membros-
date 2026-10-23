import { describe, expect, it } from 'vitest'
import { outcomeLabel, outcomeStyle, identificationWarningLabel, eventErrorLabel } from '@/lib/admin/labels'

describe('labels', () => {
  it('explica avisos de identificação mantendo o restante do erro para auditoria', () => {
    expect(identificationWarningLabel('identificador_ausente')).toContain('ausente')
    expect(identificationWarningLabel('identificador_conflitante')).toContain('conflita')
    expect(eventErrorLabel('SHARED: identificador_desconhecido')).toBe('SHARED: Checkout ou upsell não cadastrado')
    expect(eventErrorLabel('Outro erro')).toBe('Outro erro')
  })
  it('traduz resultados novos e antigos', () => {
    expect(outcomeLabel('liberado')).toBe('Liberado')
    expect(outcomeLabel('codigo_desconhecido')).toBe('Código desconhecido')
    expect(outcomeLabel('processed')).toBe('Processado')
    expect(outcomeLabel('algo_novo')).toBe('algo_novo')
    expect(outcomeLabel(null)).toBe('Processando')
  })

  it('usa estilo neutro para resultado sem cor definida', () => {
    expect(outcomeStyle('erro')).toContain('text-destaque')
    expect(outcomeStyle(null)).toContain('text-texto-suave')
  })
})
