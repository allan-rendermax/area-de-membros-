import { expect, it, vi } from 'vitest'
import { createCallModel } from '@/lib/agent/brain'

const mocks = vi.hoisted(() => ({ create: vi.fn(), constructor: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    beta = { messages: { create: mocks.create } }
    constructor(options: unknown) { mocks.constructor(options) }
  },
}))

it('limita timeout e tentativas do SDK usado na chamada ao modelo', async () => {
  mocks.create.mockResolvedValue({ id: 'fake-response' })
  const call = createCallModel('test-key', 'test-model')
  expect(await call({ system: 'Teste', tools: [], messages: [{ role: 'user', content: 'Oi' }] })).toEqual({ id: 'fake-response' })
  expect(mocks.constructor).toHaveBeenCalledExactlyOnceWith({ apiKey: 'test-key', timeout: 20000, maxRetries: 1 })
})

it('não envia fallbacks para o Haiku, que recusa o parâmetro', async () => {
  mocks.create.mockResolvedValue({ id: 'fake-response' })
  await createCallModel('test-key', 'claude-haiku-5-5')({ system: 'Teste', tools: [], messages: [{ role: 'user', content: 'Oi' }] })
  const params = mocks.create.mock.lastCall![0]
  expect(params.model).toBe('claude-haiku-5-5')
  expect(params).not.toHaveProperty('fallbacks')
  expect(params).not.toHaveProperty('betas')
})

it('mantém fallbacks nos modelos que aceitam', async () => {
  mocks.create.mockResolvedValue({ id: 'fake-response' })
  await createCallModel('test-key', 'claude-sonnet-5-5')({ system: 'Teste', tools: [], messages: [{ role: 'user', content: 'Oi' }] })
  expect(mocks.create.mock.lastCall![0]).toMatchObject({ betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
})
