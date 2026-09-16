import { describe, expect, it } from 'vitest'
import { accessGrantedEmail, escapeHtml } from '@/lib/email/templates'

const base = {
  to: 'joao@gmail.com',
  customerName: 'João',
  storeName: 'Arquitetura',
  materialTitles: ['Atlas Visual', 'Bônus <1>'],
  loginUrl: 'https://app.test/entrar?email=joao%40gmail.com',
}

describe('accessGrantedEmail', () => {
  it('primeiro acesso', () => {
    const email = accessGrantedEmail({ ...base, firstAccess: true })
    expect(email.subject).toBe('Seu acesso chegou — Arquitetura')
    expect(email.html).toContain('Atlas Visual')
    expect(email.html).toContain('Bônus &lt;1&gt;')
    expect(email.html).toContain('href="https://app.test/entrar?email=joao%40gmail.com"')
    expect(email.html).toContain('Acessar meus materiais')
  })

  it('novo material', () => {
    expect(accessGrantedEmail({ ...base, firstAccess: false }).subject).toBe('Novo material liberado — Arquitetura')
  })

  it('funciona sem títulos e sem nome', () => {
    const email = accessGrantedEmail({ ...base, customerName: '', materialTitles: [], firstAccess: true })
    expect(email.html).toContain('Olá!')
    expect(email.html).not.toContain('<ul')
  })
})

describe('escapeHtml', () => {
  it('escapa caracteres especiais', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;')
  })
})
