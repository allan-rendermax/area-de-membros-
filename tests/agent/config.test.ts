import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAgentConfig } from '@/lib/agent/config'

beforeEach(() => {
  vi.stubEnv('ZERNIO_API_KEY', 'zernio-key')
  vi.stubEnv('ZERNIO_WEBHOOK_SECRET', 's'.repeat(32))
  vi.stubEnv('ANTHROPIC_API_KEY', 'anthropic-key')
  vi.stubEnv('AGENT_ACCOUNT_IDS', '6b05a6a49f8d271e5d1941a2,6b05a8f01de1f94249e842e8')
  vi.stubEnv('AGENT_MODEL', '')
  vi.stubEnv('AGENT_STORE_SLUG', '')
  vi.stubEnv('AGENT_BATCH_SECONDS', '')
})
afterEach(() => { vi.unstubAllEnvs() })

describe('configuração do agente', () => {
  it('retorna null sem ANTHROPIC_API_KEY', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', undefined)
    expect(getAgentConfig()).toBeNull()
  })

  it.each(['ZERNIO_API_KEY', 'ANTHROPIC_API_KEY'])('recusa %s vazia ou ausente', name => {
    for (const value of [undefined, '', '   ']) {
      vi.stubEnv(name, value)
      expect(getAgentConfig()).toBeNull()
    }
  })

  it.each([undefined, '', 's'.repeat(31), ` ${'s'.repeat(31)} `])('recusa segredo inválido: %s', secret => {
    vi.stubEnv('ZERNIO_WEBHOOK_SECRET', secret)
    expect(getAgentConfig()).toBeNull()
  })

  it('lê contas separadas por vírgula', () => {
    expect(getAgentConfig()).toEqual({
      zernioApiKey: 'zernio-key', webhookSecret: 's'.repeat(32), anthropicApiKey: 'anthropic-key',
      model: 'claude-sonnet-5-5', accountIds: ['6b05a6a49f8d271e5d1941a2', '6b05a8f01de1f94249e842e8'],
      storeSlug: 'arquitetura', batchSeconds: 8, dailyResendLimit: 20, quotaReserve: 30,
    })
  })

  it('normaliza espaços e remove contas vazias e repetidas', () => {
    vi.stubEnv('ZERNIO_API_KEY', ' zernio-key ')
    vi.stubEnv('ZERNIO_WEBHOOK_SECRET', ` ${'s'.repeat(32)} `)
    vi.stubEnv('ANTHROPIC_API_KEY', ' anthropic-key ')
    vi.stubEnv('AGENT_ACCOUNT_IDS', ' acc-1, ,acc-2, acc-1, ')
    expect(getAgentConfig()).toMatchObject({
      zernioApiKey: 'zernio-key', webhookSecret: 's'.repeat(32), anthropicApiKey: 'anthropic-key',
      accountIds: ['acc-1', 'acc-2'],
    })
  })

  it.each([undefined, '', '  ', ' , , '])('retorna null sem nenhuma conta: %s', accounts => {
    vi.stubEnv('AGENT_ACCOUNT_IDS', accounts)
    expect(getAgentConfig()).toBeNull()
  })

  it('lê modelo e loja configurados sem espaços nas pontas', () => {
    vi.stubEnv('AGENT_MODEL', ' outro-modelo ')
    vi.stubEnv('AGENT_STORE_SLUG', ' outra-loja ')
    expect(getAgentConfig()).toMatchObject({ model: 'outro-modelo', storeSlug: 'outra-loja' })
  })

  it.each([undefined, '', '   '])('usa modelo e loja padrão quando vazios: %s', value => {
    vi.stubEnv('AGENT_MODEL', value)
    vi.stubEnv('AGENT_STORE_SLUG', value)
    expect(getAgentConfig()).toMatchObject({ model: 'claude-sonnet-5-5', storeSlug: 'arquitetura' })
  })

  it.each([['0', 0], [' 15 ', 15], ['60', 60]])('aceita intervalo inteiro %s', (value, expected) => {
    vi.stubEnv('AGENT_BATCH_SECONDS', value)
    expect(getAgentConfig()?.batchSeconds).toBe(expected)
  })

  it.each([undefined, '', '   ', '-1', '61', '8.5', '8s', 'NaN', 'Infinity'])('usa intervalo padrão para %s', value => {
    vi.stubEnv('AGENT_BATCH_SECONDS', value)
    expect(getAgentConfig()?.batchSeconds).toBe(8)
  })
})
