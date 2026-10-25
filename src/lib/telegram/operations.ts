import { isValidEmail, normalizeEmail } from '@/lib/domain/email'
import type { ActionResult, CustomerLookup, SupportAction, SupportDeps } from './types'

type Customer = NonNullable<CustomerLookup['customer']>
export type OperationData = {
  getCustomer(id: string): Promise<Customer | null>
  findCustomer(email: string): Promise<Customer | null>
  search(email: string): Promise<CustomerLookup['suggestions']>
  authEmail(id: string): Promise<string | null>
  destinationExists(email: string): Promise<boolean>
  access(customer: Customer): Promise<CustomerLookup['products']>
  orders(email: string): Promise<CustomerLookup['orders']>
  delivery(customerId: string): Promise<string>
  quotaAvailable(): Promise<boolean>
  changeEmail(id: string, email: string, expectedEmail: string): Promise<void>
  send(customerId: string, storeId: string, expectedEmail: string): Promise<{ ok: boolean; logId?: string }>
}
type Scope = { storeId: string; storeName: string; adminEmails: string[] }
export function createSupportOperations(scope: Scope, data: OperationData): SupportDeps['ops'] {
  async function lookupCustomer(customer: Customer | null, email = ''): Promise<CustomerLookup> {
    if (!customer) return { customer: null, storeId: scope.storeId, storeName: scope.storeName, orders: [], products: [], delivery: 'Sem cadastro', suggestions: await data.search(email) }
    const [products, orders, delivery] = await Promise.all([data.access(customer), data.orders(customer.email), data.delivery(customer.id)])
    return { customer, storeId: scope.storeId, storeName: scope.storeName, products, orders, delivery, suggestions: [] }
  }
  const refused = (text: string): ActionResult => ({ state: 'done', text })
  return {
    async lookup(email) { return lookupCustomer(await data.findCustomer(email), email) },
    async lookupId(id) { const c = await data.getCustomer(id); return c ? lookupCustomer(c) : null },
    async execute(a: SupportAction): Promise<ActionResult> {
      if (a.storeId !== scope.storeId) return refused('Esta ação pertence a outra loja. Consulte novamente.')
      const c = await data.getCustomer(a.customerId)
      if (!c || c.blocked || c.email !== a.expectedEmail) return refused('O cadastro mudou ou está bloqueado. Consulte novamente antes de agir.')
      if (await data.authEmail(c.id) !== c.email) return refused('Login e cadastro estão divergentes. É necessária conferência no admin.')
      const protectedEmails = scope.adminEmails.map(normalizeEmail)
      if (protectedEmails.includes(c.email)) return refused('Contas administrativas são protegidas. Use o admin da plataforma.')
      const before = await data.access(c)
      if (!before.length) return refused('Cliente sem produtos liberados nesta loja. Nenhum envio realizado.')
      if (!(await data.quotaAvailable())) return refused('Limite diário de e-mails atingido. Tente após a renovação da cota.')
      let expected = c.email, corrected = false
      if (a.kind === 'correct') {
        const email = normalizeEmail(a.newEmail ?? '')
        if (!isValidEmail(email) || email.length > 254 || email === c.email || protectedEmails.includes(email)) return refused('Novo e-mail inválido ou protegido. Consulte novamente.')
        if (await data.destinationExists(email)) return refused('Já existe cadastro ou login com o novo e-mail. Confira os dois cadastros no admin.')
        try {
          await data.changeEmail(c.id, email, a.expectedEmail)
          const changed = await data.getCustomer(c.id)
          if (!changed || changed.email !== email || changed.blocked || await data.authEmail(c.id) !== email) throw new Error('correction_unverified')
          const after = await data.access(changed)
          if (!before.every(p => after.some(q => p.id === q.id && p.level === q.level))) throw new Error('access_changed')
          expected = email; corrected = true
        } catch { return { state: 'uncertain', text: 'Não foi possível confirmar a correção completa. Confira login, compras e acesso no admin antes de repetir.' } }
      }
      try {
        const sent = await data.send(c.id, scope.storeId, expected)
        if (!sent.ok) throw new Error('send_unverified')
        return { state: 'done', text: `${corrected ? 'E-mail corrigido e acesso preservado.\n' : ''}Envio para ${expected} aceito pelo provedor. Use “Conferir cadastro e envio” para verificar a entrega.`, logId: sent.logId }
      } catch {
        return { state: 'uncertain', text: `${corrected ? `E-mail corrigido para ${expected} e acesso preservado.\n` : ''}Não foi possível confirmar o envio. Confira o registro no admin/provedor antes de repetir.` }
      }
    },
  }
}
