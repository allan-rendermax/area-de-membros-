import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeNotifier, FakeRepo } from '../helpers/fakes'
import paid from '../fixtures/payt-paid.json'

let repo: FakeRepo
let notifier: FakeNotifier

vi.mock('@/lib/data/postback-repo', () => ({ createPostbackRepo: () => repo }))
vi.mock('@/lib/email/server', () => ({ notifyAccess: (notice: Parameters<FakeNotifier['notify']>[0]) => notifier.notify(notice) }))
vi.mock('@/lib/env', () => ({ env: { paytIntegrationKey: 'chave-de-teste' } }))

import { POST } from '@/app/api/webhooks/payt/route'

const request = (body: unknown) => new Request('https://members.example.test/api/webhooks/payt', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

beforeEach(() => {
  repo = new FakeRepo()
  notifier = new FakeNotifier()
})

describe('POST Payt', () => {
  it('responde 200 ao teste autenticado mesmo com consultas de compra indisponíveis', async () => {
    vi.spyOn(repo, 'findStoreForProductCode').mockRejectedValue(new Error('consulta de compra indisponível'))
    const response = await POST(request({ ...paid, test: true }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, result: 'ignored' })
    expect(repo.events[0]).toMatchObject({ keyValid: true, outcome: 'teste' })
    expect(repo.orders).toHaveLength(0)
    expect(repo.customers).toHaveLength(0)
    expect(notifier.sent).toHaveLength(0)
  })

  it('recusa teste não autenticado com 401', async () => {
    const response = await POST(request({ ...paid, test: true, integration_key: 'errada' }))
    expect(response.status).toBe(401)
    expect(repo.events[0]).toMatchObject({ keyValid: false, outcome: 'chave_invalida' })
  })

  it('recusa teste sem dados obrigatórios com 400', async () => {
    const response = await POST(request({ integration_key: 'chave-de-teste', test: true }))
    expect(response.status).toBe(400)
    expect(repo.events[0]).toMatchObject({ keyValid: true, outcome: 'invalido' })
  })

  it.each(['logEvent', 'finishEvent'] as const)('não confirma recebimento se %s falhar', async (method) => {
    vi.spyOn(repo, method).mockRejectedValue(new Error('banco indisponível'))
    const response = await POST(request({ ...paid, test: true }))
    expect(response.status).toBe(500)
    expect(repo.orders).toHaveLength(0)
    expect(notifier.sent).toHaveLength(0)
  })

  it('mantém resposta de liberação e envio de acesso para uma compra real', async () => {
    const response = await POST(request(paid))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, result: 'liberado' })
    expect(repo.orders).toHaveLength(1)
    expect(notifier.sent).toHaveLength(1)
  })
})
