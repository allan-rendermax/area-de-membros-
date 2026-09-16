import { beforeEach, describe, expect, it } from 'vitest'
import { processPostback } from '@/lib/orders/process-postback'
import paid from '../fixtures/payt-paid.json'
import { FakeMailer, FakeRepo } from '../helpers/fakes'

const KEY = 'chave-de-teste'
let repo: FakeRepo
let mailer: FakeMailer

function run(body: unknown) {
  return processPostback(body, { repo, mailer, integrationKey: KEY, storeSlug: 'arquitetura' })
}
const withStatus = (status: string, extra: object = {}) => ({ ...paid, status, ...extra })

beforeEach(() => {
  repo = new FakeRepo()
  mailer = new FakeMailer()
})

describe('processPostback', () => {
  it('recusa chave de integração inválida e registra o evento', async () => {
    const result = await run({ ...paid, integration_key: 'errada' })
    expect(result).toEqual({ kind: 'unauthorized' })
    expect(repo.orders).toHaveLength(0)
    expect(repo.events[0]).toMatchObject({ keyValid: false, outcome: 'unauthorized' })
  })

  it('recusa payload sem chave', async () => {
    expect(await run({ status: 'paid' })).toEqual({ kind: 'unauthorized' })
  })

  it('compra paga de email novo cria cliente e envia primeiro acesso', async () => {
    const result = await run(paid)
    expect(result).toMatchObject({ kind: 'processed', status: 'pago', changed: true, customerCreated: true, emailSent: true })
    expect(repo.customers).toEqual([{ id: 'cus-1', email: 'joao@gmail.com', name: 'João Silva', blockedAt: null }])
    expect(mailer.sent).toEqual([
      { to: 'joao@gmail.com', customerName: 'João Silva', storeName: 'Arquitetura', materialTitles: ['Atlas Visual', 'Bônus 1'], firstAccess: true },
    ])
    expect(repo.events[0]).toMatchObject({ keyValid: true, outcome: 'processed' })
  })

  it('aviso repetido não duplica cliente nem email', async () => {
    await run(paid)
    const second = await run(paid)
    expect(second).toMatchObject({ kind: 'processed', changed: false, customerCreated: false, emailSent: false })
    expect(repo.customers).toHaveLength(1)
    expect(mailer.sent).toHaveLength(1)
  })

  it('aviso pendente atrasado não retrocede pedido pago', async () => {
    await run(paid)
    const late = await run(withStatus('waiting_payment'))
    expect(late).toMatchObject({ status: 'pago', changed: false })
    expect(mailer.sent).toHaveLength(1)
  })

  it('reembolso vale e pago atrasado não devolve acesso', async () => {
    await run(paid)
    expect(await run(withStatus('refunded'))).toMatchObject({ status: 'reembolsado', changed: true, emailSent: false })
    expect(await run(paid)).toMatchObject({ status: 'reembolsado', changed: false, emailSent: false })
    expect(mailer.sent).toHaveLength(1)
  })

  it('chargeback muda o status sem email', async () => {
    await run(paid)
    expect(await run(withStatus('chargeback'))).toMatchObject({ status: 'chargeback', emailSent: false })
  })

  it('cliente existente comprando outra oferta recebe email de novo material', async () => {
    await run(paid)
    await run({ ...paid, transaction_id: 'TX999', product: { name: 'Bump', code: 'BUMP' } })
    expect(mailer.sent[1]).toMatchObject({ firstAccess: false, materialTitles: [] })
    expect(repo.customers).toHaveLength(1)
  })

  it('pedido pendente de email novo não cria cliente', async () => {
    const result = await run(withStatus('waiting_payment'))
    expect(result).toMatchObject({ status: 'pendente', customerCreated: false, emailSent: false })
    expect(repo.customers).toHaveLength(0)
  })

  it('status irrelevante é ignorado sem criar pedido', async () => {
    expect(await run(withStatus('lost_cart'))).toEqual({ kind: 'ignored', reason: 'lost_cart' })
    expect(repo.orders).toHaveLength(0)
    expect(repo.events[0]).toMatchObject({ outcome: 'ignored' })
  })

  it('payload inválido com chave certa é registrado', async () => {
    const result = await run({ ...paid, customer: { name: 'X', email: 'x' } })
    expect(result.kind).toBe('invalid')
    expect(repo.events[0]).toMatchObject({ keyValid: true, outcome: 'invalid' })
  })

  it('falha no email não desfaz o pedido e fica registrada', async () => {
    mailer.fail = true
    const result = await run(paid)
    expect(result).toMatchObject({ kind: 'processed', status: 'pago', customerCreated: true, emailSent: false, emailError: 'resend fora do ar' })
    expect(repo.events[0]).toMatchObject({ outcome: 'processed', error: 'falha no email: resend fora do ar' })
  })

  it('se criar o cliente falhar, a nova tentativa cria e envia o email', async () => {
    repo.failCreateCustomerTimes = 1
    await expect(run(paid)).rejects.toThrow('auth indisponível')
    expect(repo.events[0]).toMatchObject({ outcome: 'failed', error: 'auth indisponível' })

    const retry = await run(paid)
    expect(retry).toMatchObject({ changed: false, customerCreated: true, emailSent: true })
    expect(mailer.sent).toHaveLength(1)
  })

  it('cliente criado ao mesmo tempo por outro aviso não recebe boas-vindas duplicado', async () => {
    repo.customers.push({ id: 'cus-existente', email: 'joao@gmail.com', name: 'João Silva', blockedAt: null })
    repo.hideCustomerFromLookupOnce = true
    const result = await run(paid)
    expect(result).toMatchObject({ changed: true, customerCreated: false, emailSent: true })
    expect(mailer.sent[0]).toMatchObject({ firstAccess: false })
    expect(repo.customers).toHaveLength(1)
  })

  it('loja inexistente gera falha registrada', async () => {
    await expect(
      processPostback(paid, { repo, mailer, integrationKey: KEY, storeSlug: 'outra' }),
    ).rejects.toThrow('Loja não encontrada: outra')
    expect(repo.events[0]).toMatchObject({ outcome: 'failed' })
  })
})
