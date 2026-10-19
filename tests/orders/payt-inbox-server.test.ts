import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ claim: vi.fn(), complete: vi.fn(), fail: vi.fn(), process: vi.fn() }))
vi.mock('@/lib/data/payt-inbox', () => ({ createPaytInboxRepo: () => mocks }))
vi.mock('@/lib/data/postback-repo', () => ({ createPostbackRepo: () => ({}) }))
vi.mock('@/lib/email/server', () => ({ notifyAccess: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: { paytIntegrationKey: 'new-key' } }))
vi.mock('@/lib/orders/process-postback', () => ({ processPostback: mocks.process }))
import { runPaytInbox } from '@/lib/orders/payt-inbox-server'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.claim.mockResolvedValueOnce({ id: 'j1', eventId: 'e1', leaseToken: 'lease', payload: { integration_key: 'accepted-key' } }).mockResolvedValue(null)
})
it('mantém recuperável produto sem conteúdo, sem concluir a fila como entregue', async () => {
  mocks.process.mockResolvedValue({ kind: 'processed', unknownCodes: [], emailErrors: ['nenhum produto publicado'] })
  await runPaytInbox()
  expect(mocks.complete).not.toHaveBeenCalled()
  expect(mocks.fail).toHaveBeenCalledWith(expect.anything(), 'nenhum produto publicado')
})
it('usa a autenticação já persistida mesmo se a chave atual mudar antes do processamento', async () => {
  mocks.process.mockResolvedValue({ kind: 'processed', unknownCodes: [], emailErrors: [] })
  await runPaytInbox()
  expect(mocks.process).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ integrationKey: 'accepted-key', eventId: 'e1' }))
  expect(mocks.complete).toHaveBeenCalledTimes(1)
})
