import { beforeEach, describe, expect, it } from 'vitest'
import type { AccessNotice } from '@/lib/domain/types'
import {
  formatFrom,
  loginUrlFor,
  sendAccessNotice,
  type EmailLogFinish,
  type EmailLogRepo,
  type EmailLogStart,
  type EmailTransport,
  type OutgoingEmail,
} from '@/lib/email/notifier'

class FakeLog implements EmailLogRepo {
  rows: ({ id: string } & EmailLogStart & Partial<EmailLogFinish>)[] = []
  async start(entry: EmailLogStart) {
    const id = `log-${this.rows.length + 1}`
    this.rows.push({ id, ...entry })
    return id
  }
  async finish(id: string, result: EmailLogFinish) {
    Object.assign(this.rows.find((r) => r.id === id)!, result)
  }
}

class FakeTransport implements EmailTransport {
  sent: OutgoingEmail[] = []
  fail: string | null = null
  async send(email: OutgoingEmail) {
    if (this.fail) throw new Error(this.fail)
    this.sent.push(email)
    return { providerId: `re_${this.sent.length}` }
  }
}

const notice: AccessNotice = {
  customerId: 'c1',
  to: 'joao@gmail.com',
  customerName: 'João',
  store: { id: 's1', slug: 'arquitetura', name: 'Arquitetura' },
  products: [{ id: 'p1', title: 'Atlas Visual' }],
  kind: 'acesso_novo',
}

let log: FakeLog
let transport: FakeTransport
const deps = () => ({ log, transport, appUrl: 'https://app.test/', emailFrom: 'Área de Membros <acesso@grupoelevamax.com>' })

beforeEach(() => {
  log = new FakeLog()
  transport = new FakeTransport()
})

describe('formatFrom', () => {
  it('usa o nome da loja com o endereço configurado', () => {
    expect(formatFrom('Arquitetura', 'acesso@grupoelevamax.com')).toBe('"Arquitetura" <acesso@grupoelevamax.com>')
    expect(formatFrom('Arquitetura', 'Área de Membros <acesso@grupoelevamax.com>')).toBe('"Arquitetura" <acesso@grupoelevamax.com>')
  })

  it('remove caracteres que quebram o cabeçalho', () => {
    expect(formatFrom('Loja "X" <y>', 'a@b.com')).toBe('"Loja X y" <a@b.com>')
  })
})

describe('loginUrlFor', () => {
  it('monta o login da loja com o e-mail preenchido', () => {
    expect(loginUrlFor('https://app.test/', 'arquitetura', 'joao@gmail.com')).toBe(
      'https://app.test/arquitetura/entrar?email=joao%40gmail.com',
    )
  })
})

describe('sendAccessNotice', () => {
  it('registra o envio e marca como enviado', async () => {
    const result = await sendAccessNotice(notice, deps())
    expect(result).toEqual({ ok: true, logId: 'log-1' })
    expect(log.rows[0]).toMatchObject({
      storeId: 's1', customerId: 'c1', toEmail: 'joao@gmail.com', kind: 'acesso_novo',
      productIds: ['p1'], status: 'enviado', providerId: 're_1',
    })
    expect(transport.sent[0]).toMatchObject({
      from: '"Arquitetura" <acesso@grupoelevamax.com>',
      to: 'joao@gmail.com',
      subject: 'Seu acesso chegou — Arquitetura',
    })
    expect(transport.sent[0].html).toContain('https://app.test/arquitetura/entrar?email=joao%40gmail.com')
  })

  it('falha no envio vira falhou com o erro', async () => {
    transport.fail = 'domínio não verificado'
    const result = await sendAccessNotice(notice, deps())
    expect(result).toEqual({ ok: false, error: 'domínio não verificado', logId: 'log-1' })
    expect(log.rows[0]).toMatchObject({ status: 'falhou', error: 'domínio não verificado' })
  })
})
