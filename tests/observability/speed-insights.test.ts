import { describe, expect, it } from 'vitest'
import { sanitizeSpeedInsightsEvent } from '@/lib/observability/speed-insights'

describe('privacidade do Speed Insights', () => {
  it('remove parâmetros e fragmentos sem alterar a medição ou o evento original', () => {
    const event = { url: 'https://members.example.com/loja/item/123?email=aluna%40example.com&token=secret#session', type: 'vital', value: 230 }
    expect(sanitizeSpeedInsightsEvent(event)).toEqual({ ...event, url: 'https://members.example.com/loja/item/123' })
    expect(event.url).toContain('token=secret')
  })

  it.each([
    'https://members.example.com/admin',
    'https://members.example.com/admin/lojas',
    'https://members.example.com/api/auth',
    'https://members.example.com/loja?previa=1',
    'https://members.example.com/loja?simular=basic',
    'javascript:alert(1)',
    'not a URL',
  ])('descarta navegação administrativa, prévias e URL inválida: %s', (url) => {
    expect(sanitizeSpeedInsightsEvent({ url })).toBeNull()
  })

  it('preserva rotas públicas e de alunos com métricas sem credenciais na URL', () => {
    expect(sanitizeSpeedInsightsEvent({ url: 'https://user:pass@members.example.com/loja?utm_source=ig', value: 12 }))
      .toEqual({ url: 'https://members.example.com/loja', value: 12 })
  })
})
