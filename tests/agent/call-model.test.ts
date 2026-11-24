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
