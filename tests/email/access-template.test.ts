import { describe, expect, it } from 'vitest'
import type { AccessNotice } from '@/lib/domain/types'
import { accessNoticeEmail } from '@/lib/email/access-template'

const notice: AccessNotice = {
  customerId: 'c1',
  to: 'joao@gmail.com',
  customerName: 'João Silva',
  store: { id: 's1', slug: 'arquitetura', name: 'Arquitetura' },
  products: [{ id: 'p1', title: 'Atlas Visual' }, { id: 'p2', title: 'Bônus <1>' }],
  kind: 'acesso_novo',
}
const url = 'https://app.test/arquitetura/entrar?email=joao%40gmail.com'

describe('accessNoticeEmail', () => {
  it('usa a identidade de arquitetura apenas nessa loja', () => {
    const architecture = accessNoticeEmail(notice, url).html
    expect(architecture).toContain('background:#ffffff')
    expect(architecture).toContain('background:#f7f6f5')
    expect(architecture).toContain('background:#ffd53d;color:#171717')
    expect(architecture).toContain('border-bottom:4px solid #ff5a16')
    expect(architecture).not.toContain('text-transform:uppercase')
    expect(architecture).not.toContain('Impact')
    expect(architecture).toContain('border-radius:6px')
    const otherStore = accessNoticeEmail({ ...notice, store: { ...notice.store, slug: 'outra' } }, url).html
    expect(otherStore).not.toContain('#ffd53d')
    expect(otherStore).toContain('background:#c8192b')
  })
  it('primeiro acesso lista produtos, escapa títulos e aponta para o login da loja', () => {
    const email = accessNoticeEmail(notice, url)
    expect(email.subject).toBe('Seus materiais estão liberados — Arquitetura')
    expect(email.html).toContain('Olá, João!')
    expect(email.html).toContain('Atlas Visual')
    expect(email.html).toContain('Bônus &lt;1&gt;')
    expect(email.html).toContain(`href="${url}"`)
    expect(email.html).toContain('Acessar meus materiais')
    expect(email.html).toContain('Sem criar uma senha.')
    expect(email.html).toContain('joao@gmail.com')
    expect(email.html.match(/href=/g)).toHaveLength(2)
    expect(email.html).not.toContain('#demo')
  })

  it('assunto muda para produto novo e reenvio', () => {
    expect(accessNoticeEmail({ ...notice, kind: 'produto_novo' }, url).subject).toBe('Novo produto liberado — Arquitetura')
    expect(accessNoticeEmail({ ...notice, kind: 'reenvio' }, url).subject).toBe('Seu acesso — Arquitetura')
  })

  it('funciona sem nome e sem produtos', () => {
    const email = accessNoticeEmail({ ...notice, customerName: '', products: [] }, url)
    expect(email.html).toContain('Olá!')
    expect(email.html).not.toContain('<ul')
    expect(email.html).not.toContain('Material liberado para você')
  })

  it('identifica o produto no assunto quando há apenas um material', () => {
    expect(accessNoticeEmail({ ...notice, products: [notice.products[0]] }, url).subject)
      .toBe('Seu acesso: Atlas Visual — liberado')
  })

  it('reenvio e novo material não confirmam uma nova compra', () => {
    for (const kind of ['reenvio', 'produto_novo'] as const) {
      const email = accessNoticeEmail({ ...notice, kind }, url)
      expect(email.html).not.toContain('Sua compra foi confirmada')
      expect(email.html).not.toContain('porque uma compra foi confirmada')
    }
  })

  it('escapa todos os dados dinâmicos e ambos os links', () => {
    const email = accessNoticeEmail({ ...notice, customerName: '<João>', to: '<email>', store: { ...notice.store, name: '<Loja>' } }, url + '&a="x"')
    expect(email.html).toContain('&lt;João&gt;')
    expect(email.html).toContain('&lt;email&gt;')
    expect(email.html).toContain('&lt;Loja&gt;')
    expect(email.html).not.toContain('<Loja>')
    expect(email.html.match(/&amp;a=&quot;x&quot;/g)).toHaveLength(2)
  })
})
