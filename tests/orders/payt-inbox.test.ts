import { describe, expect, it, vi } from 'vitest'
import { inboxKey, drainInbox, type InboxRepo } from '@/lib/orders/payt-inbox'
import { parsePaytPostback } from '@/lib/payt/parse'
import paid from '../fixtures/payt-paid.json'
import { processPostback } from '@/lib/orders/process-postback'
import { FakeRepo, FakeNotifier } from '../helpers/fakes'

describe('inbox Payt', () => {
  it('retomada após envio não duplica pedido ou acesso; preserva compra histórica', async () => {
    const orders = new FakeRepo()
    const notifier = new FakeNotifier()
    const process = (payload: unknown, eventId?: string) => processPostback(payload, {
      repo: orders, integrationKey: 'chave-de-teste', eventId,
      notify: async (notice) => {
        const result = await notifier.notify(notice)
        orders.markNotified(notice.customerId, notice.store.id, notice.products.map(p => p.id))
        return result
      },
    })
    // Venda anterior à implantação, já entregue.
    await process(paid)
    const before = structuredClone(orders.orders)
    const eventId = await orders.logEvent(paid)
    const job = { id: 'j1', eventId, payload: paid, leaseToken: 't1' }
    const repo: InboxRepo = {
      enqueue: vi.fn(), claim: vi.fn().mockResolvedValueOnce(job).mockResolvedValue(null),
      complete: vi.fn().mockRejectedValueOnce(new Error('falha após processamento')), fail: vi.fn(),
    }
    await drainInbox(repo, process)
    vi.mocked(repo.claim).mockResolvedValueOnce({ ...job, leaseToken: 't2' }).mockResolvedValue(null)
    await drainInbox(repo, process)
    expect(orders.orders).toEqual(before)
    expect(orders.customers).toHaveLength(1)
    expect(notifier.sent).toHaveLength(1)
    expect(orders.events).toHaveLength(2)
  })
  it('identifica repetição sem depender de campos de rastreamento ou ordem dos produtos', () => {
    const a = parsePaytPostback(paid)
    const b = parsePaytPostback({ ...paid, tracking: { utm_source: 'changed' } })
    if (!a.ok || !b.ok) throw new Error('fixture inválida')
    expect(inboxKey(a.value)).toBe(inboxKey(b.value))
    expect(inboxKey(a.value)).not.toBe(inboxKey({ ...a.value, status: 'refunded' }))
    expect(inboxKey(a.value)).not.toBe(inboxKey({ ...a.value, products: [...a.value.products, { code: 'bump', name: '', amountCents: 100 }] }))
  })

  it('processa uma vez, confirma conclusão e deixa falha recuperável na fila', async () => {
    const job = { id: 'j1', eventId: 'e1', payload: paid, leaseToken: 't1' }
    const repo: InboxRepo = {
      enqueue: vi.fn(), claim: vi.fn().mockResolvedValueOnce(job).mockResolvedValue(null),
      complete: vi.fn(), fail: vi.fn(),
    }
    const process = vi.fn().mockResolvedValue(undefined)
    await drainInbox(repo, process)
    expect(process).toHaveBeenCalledExactlyOnceWith(paid, 'e1')
    expect(repo.complete).toHaveBeenCalledExactlyOnceWith(job)
    expect(repo.fail).not.toHaveBeenCalled()
    vi.mocked(repo.claim).mockResolvedValueOnce(job).mockResolvedValue(null)
    process.mockRejectedValueOnce(new Error('banco temporariamente indisponível'))
    await drainInbox(repo, process)
    expect(repo.fail).toHaveBeenCalledExactlyOnceWith(job, 'banco temporariamente indisponível')
    expect(repo.complete).toHaveBeenCalledTimes(1)
  })
})
