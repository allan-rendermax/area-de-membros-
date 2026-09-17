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
  it('primeiro acesso lista produtos, escapa títulos e aponta para o login da loja', () => {
    const email = accessNoticeEmail(notice, url)
    expect(email.subject).toBe('Seu acesso chegou — Arquitetura')
    expect(email.html).toContain('Olá, João!')
    expect(email.html).toContain('Atlas Visual')
    expect(email.html).toContain('Bônus &lt;1&gt;')
    expect(email.html).toContain(`href="${url}"`)
    expect(email.html).toContain('Acessar meus produtos')
  })

  it('assunto muda para produto novo e reenvio', () => {
    expect(accessNoticeEmail({ ...notice, kind: 'produto_novo' }, url).subject).toBe('Novo produto liberado — Arquitetura')
    expect(accessNoticeEmail({ ...notice, kind: 'reenvio' }, url).subject).toBe('Seu acesso — Arquitetura')
  })

  it('funciona sem nome e sem produtos', () => {
    const email = accessNoticeEmail({ ...notice, customerName: '', products: [] }, url)
    expect(email.html).toContain('Olá!')
    expect(email.html).not.toContain('<ul')
  })
})
