import { beforeEach, describe, expect, it } from 'vitest'
import { processPostback } from '@/lib/orders/process-postback'
import bumps from '../fixtures/payt-paid-bumps.json'
import paid from '../fixtures/payt-paid.json'
import { ARQ, FakeNotifier, FakeRepo } from '../helpers/fakes'

const KEY = 'chave-de-teste'
let repo: FakeRepo
let notifier: FakeNotifier

function run(body: unknown) {
  return processPostback(body, { repo, notify: notifier.notify, integrationKey: KEY })
}
const withStatus = (status: string, extra: object = {}) => ({ ...paid, status, ...extra })

beforeEach(() => {
  repo = new FakeRepo()
  notifier = new FakeNotifier()
})

describe('processPostback', () => {
  it('recusa chave de integração inválida e registra o evento', async () => {
    expect(await run({ ...paid, integration_key: 'errada' })).toEqual({ kind: 'unauthorized' })
    expect(repo.orders).toHaveLength(0)
    expect(repo.events[0]).toMatchObject({ keyValid: false, outcome: 'chave_invalida' })
  })

  it('recusa payload sem chave', async () => {
    expect(await run({ status: 'paid' })).toEqual({ kind: 'unauthorized' })
  })

  it('compra paga de email novo cria cliente e envia primeiro acesso', async () => {
    const result = await run(paid)
    expect(result).toMatchObject({ kind: 'processed', outcome: 'liberado', status: 'pago', customerCreated: true, emailsSent: 1, unknownCodes: [] })
    expect(repo.customers).toEqual([{ id: 'cus-1', email: 'joao@gmail.com', name: 'João Silva', blockedAt: null }])
    expect(notifier.sent).toEqual([
      {
        customerId: 'cus-1',
        to: 'joao@gmail.com',
        customerName: 'João Silva',
        store: ARQ,
        products: [{ id: 'p-atlas', title: 'Atlas Visual' }, { id: 'p-bonus1', title: 'Bônus 1' }],
        kind: 'acesso_novo',
      },
    ])
    expect(repo.events[0]).toMatchObject({
      keyValid: true, outcome: 'liberado', customerEmail: 'joao@gmail.com', productCodes: ['ATLAS-COMPLETO'], paytStatus: 'paid',
    })
    expect(repo.orders[0]).toMatchObject({ storeId: 'store-1', productCode: 'ATLAS-COMPLETO', amountCents: 4700 })
  })

  it('aviso repetido não duplica cliente nem email', async () => {
    await run(paid)
    expect(await run(paid)).toMatchObject({ outcome: 'sem_mudanca', customerCreated: false, emailsSent: 0 })
    expect(repo.customers).toHaveLength(1)
    expect(notifier.sent).toHaveLength(1)
  })

  it('aviso pendente atrasado não retrocede pedido pago', async () => {
    await run(paid)
    expect(await run(withStatus('waiting_payment'))).toMatchObject({ status: 'pago', outcome: 'sem_mudanca' })
    expect(notifier.sent).toHaveLength(1)
  })

  it('reembolso vale e pago atrasado não devolve acesso', async () => {
    await run(paid)
    expect(await run(withStatus('refunded'))).toMatchObject({ status: 'reembolsado', outcome: 'atualizado', emailsSent: 0 })
    expect(await run(paid)).toMatchObject({ status: 'reembolsado', outcome: 'sem_mudanca', emailsSent: 0 })
    expect(notifier.sent).toHaveLength(1)
  })

  it('chargeback muda o status sem email', async () => {
    await run(paid)
    expect(await run(withStatus('chargeback'))).toMatchObject({ status: 'chargeback', emailsSent: 0 })
  })

  it('cliente existente comprando outra oferta recebe email de produto novo', async () => {
    await run(paid)
    await run({ ...paid, transaction_id: 'TX999', product: { name: 'Pack', code: 'BUMP-PACK' } })
    expect(notifier.sent[1]).toMatchObject({ kind: 'produto_novo', products: [{ id: 'p-pack', title: 'Pack de Detalhes' }] })
    expect(repo.customers).toHaveLength(1)
  })

  it('pedido pendente de email novo não cria cliente', async () => {
    expect(await run(withStatus('waiting_payment'))).toMatchObject({ status: 'pendente', customerCreated: false, emailsSent: 0 })
    expect(repo.customers).toHaveLength(0)
  })

  it('status irrelevante é ignorado sem criar pedido', async () => {
    expect(await run(withStatus('lost_cart'))).toEqual({ kind: 'ignored', reason: 'lost_cart' })
    expect(repo.orders).toHaveLength(0)
    expect(repo.events[0]).toMatchObject({ outcome: 'ignorado', paytStatus: 'lost_cart' })
  })

  it('payload inválido com chave certa é registrado', async () => {
    const result = await run({ ...paid, customer: { name: 'X', email: 'x' } })
    expect(result.kind).toBe('invalid')
    expect(repo.events[0]).toMatchObject({ keyValid: true, outcome: 'invalido' })
  })

  it('falha no email não desfaz o pedido e fica registrada', async () => {
    notifier.fail = true
    const result = await run(paid)
    expect(result).toMatchObject({ outcome: 'liberado', status: 'pago', customerCreated: true, emailsSent: 0, emailErrors: ['resend fora do ar'] })
    expect(repo.events[0]).toMatchObject({ outcome: 'liberado', error: 'falha no email: resend fora do ar' })
  })

  it('notify lançando erro não derruba o processamento e fica registrado', async () => {
    notifier.throwError = true
    const result = await run(paid)
    expect(result).toMatchObject({
      kind: 'processed', outcome: 'liberado', status: 'pago', emailsSent: 0, emailErrors: ['notify indisponível'],
    })
    expect(repo.events[0]).toMatchObject({ outcome: 'liberado', error: 'falha no email: notify indisponível' })
  })

  it('getProductsForCode lançando erro não derruba o processamento e fica registrado', async () => {
    repo.failGetProductsForCode = 'ATLAS-COMPLETO'
    const result = await run(paid)
    expect(result).toMatchObject({
      kind: 'processed', outcome: 'liberado', status: 'pago', emailsSent: 0, emailErrors: ['produtos indisponíveis'],
    })
    expect(repo.events[0]).toMatchObject({ outcome: 'liberado', error: 'falha no email: produtos indisponíveis' })
  })

  it('se criar o cliente falhar, a nova tentativa cria e envia o email', async () => {
    repo.failCreateCustomerTimes = 1
    await expect(run(paid)).rejects.toThrow('auth indisponível')
    expect(repo.events[0]).toMatchObject({ outcome: 'erro', error: 'auth indisponível' })

    expect(await run(paid)).toMatchObject({ customerCreated: true, emailsSent: 1 })
    expect(notifier.sent).toHaveLength(1)
  })

  it('cliente criado ao mesmo tempo por outro aviso não recebe boas-vindas duplicado', async () => {
    repo.customers.push({ id: 'cus-existente', email: 'joao@gmail.com', name: 'João Silva', blockedAt: null })
    repo.hideCustomerFromLookupOnce = true
    expect(await run(paid)).toMatchObject({ customerCreated: false, emailsSent: 1 })
    expect(notifier.sent[0]).toMatchObject({ kind: 'produto_novo', customerId: 'cus-existente' })
    expect(repo.customers).toHaveLength(1)
  })

  it('aviso com bumps libera principal e bumps num único email', async () => {
    const result = await run(bumps)
    expect(result).toMatchObject({ outcome: 'liberado', emailsSent: 1 })
    expect(repo.orders.map((o) => [o.productCode, o.status])).toEqual([
      ['ATLAS-COMPLETO', 'pago'],
      ['BUMP-CHECKLIST', 'pago'],
      ['BUMP-PACK', 'pago'],
    ])
    expect(notifier.sent).toHaveLength(1)
    expect(notifier.sent[0].products.map((p) => p.id)).toEqual(['p-atlas', 'p-bonus1', 'p-check', 'p-pack'])
  })

  it('reembolso só do bump mantém o principal', async () => {
    await run(bumps)
    await run({ ...paid, transaction_id: 'TX200', status: 'refunded', product: { name: 'Pack de Detalhes', code: 'BUMP-PACK' } })
    expect(repo.orders.map((o) => [o.productCode, o.status])).toEqual([
      ['ATLAS-COMPLETO', 'pago'],
      ['BUMP-CHECKLIST', 'pago'],
      ['BUMP-PACK', 'reembolsado'],
    ])
  })

  it('código desconhecido fica registrado sem travar o resto', async () => {
    const result = await run({ ...bumps, order_bumps: [{ name: 'Novo', code: 'DESCONHECIDO', price: 500 }] })
    expect(result).toMatchObject({ outcome: 'liberado', unknownCodes: ['DESCONHECIDO'], emailsSent: 1 })
    expect(repo.orders.find((o) => o.productCode === 'DESCONHECIDO')).toMatchObject({ storeId: null, status: 'pago' })
    expect(repo.events[0].error).toBe('códigos desconhecidos: DESCONHECIDO')
  })

  it('só código desconhecido cria o cliente mas não envia email', async () => {
    const result = await run({ ...paid, product: { name: 'Outro nicho', code: 'NADA' } })
    expect(result).toMatchObject({ outcome: 'codigo_desconhecido', emailsSent: 0, unknownCodes: ['NADA'] })
    expect(repo.customers).toHaveLength(1)
    expect(notifier.sent).toHaveLength(0)
  })
})
