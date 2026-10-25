import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlatformOperations } from '@/lib/telegram/platform'
import type { SupportAction } from '@/lib/telegram/types'

const io = vi.hoisted(() => ({ email: 'old@example.test', noticeEmail: 'old@example.test', getNotice: vi.fn(), notify: vi.fn(), access: vi.fn(), provider: vi.fn(), rows: [] as { provider_id: string | null; status: string; to_email: string; created_at: string }[] }))
vi.mock('@/lib/data/stores', () => ({ getStoreBySlug: async () => ({ id: 'store', name: 'Loja' }) }))
vi.mock('@/lib/data/customers', () => ({ getCustomer: async () => ({ id: 'customer', email: io.email, name: 'Cliente', blockedAt: null }), findCustomerByEmail: async () => ({ id: 'customer', email: io.email, name: 'Cliente', blockedAt: null }), changeCustomerEmail: vi.fn() }))
vi.mock('@/lib/data/access', () => ({ loadStoreAccess: io.access }))
vi.mock('@/lib/data/email-log', () => ({ countEmailsUsedToday: async () => 0 }))
vi.mock('@/lib/email/server', () => ({ buildResendNotice: io.getNotice, notifyAccess: io.notify }))
vi.mock('@/lib/telegram/client', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/telegram/client')>(), readProviderEmail: io.provider }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  auth: { admin: { getUserById: async () => ({ data: { user: { email: io.email } }, error: null }) } },
  from: (table: string) => {
    const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => ({ data: table === 'email_log' ? io.rows : [], error: null }) }
    return chain
  },
}) }))
const action: SupportAction = { id: 'action', userId: 123, chatId: 123, kind: 'resend', customerId: 'customer', storeId: 'store', expectedEmail: 'old@example.test', newEmail: null, state: 'processing', expiresAt: '', promptId: null, logId: null, result: null }
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.test'); vi.stubEnv('APP_URL', 'https://members.example.test'); vi.stubEnv('RESEND_API_KEY', 'fake-test-only')
  io.email = 'old@example.test'; io.rows = []
  io.access.mockReset().mockResolvedValue({ products: [{ id: 'product', title: 'Atlas', sortOrder: 0, isPublished: true }, { id: 'draft', title: 'Rascunho', isPublished: false }], granted: new Set(['product', 'draft']), levels: new Map([['product', 'complete'], ['draft', 'complete']]) })
  io.getNotice.mockReset().mockResolvedValue({ to: 'old@example.test', customerId: 'customer' })
  io.notify.mockReset().mockResolvedValue({ ok: true, logId: 'log' })
  io.provider.mockReset().mockResolvedValue({ subject: 'Seu acesso', event: 'delivered' })
})
describe('adapter da plataforma', () => {
  it('destinatário mudou na preparação: não envia aviso', async () => {
    io.getNotice.mockResolvedValue({ to: 'other@example.test', customerId: 'customer' })
    const r = await (await createPlatformOperations('loja')).execute(action)
    expect(r.state).toBe('uncertain'); expect(io.notify).not.toHaveBeenCalled()
  })
  it('impede links localhost em e-mail real', async () => {
    vi.stubEnv('APP_URL', 'http://localhost:3000')
    const r = await (await createPlatformOperations('loja')).execute(action)
    expect(r.state).toBe('uncertain'); expect(io.notify).not.toHaveBeenCalled()
  })
  it('reaproveita aviso transacional e guarda o ID do log', async () => {
    const r = await (await createPlatformOperations('loja')).execute(action)
    expect(r.logId).toBe('log'); expect(io.notify).toHaveBeenCalledTimes(1)
  })
  it('consulta somente produtos publicados efetivamente liberados', async () => {
    const r = await (await createPlatformOperations('loja')).lookup('old@example.test')
    expect(r.products).toEqual([{ id: 'product', title: 'Atlas', level: 'complete' }])
  })
  it('exclui convite do WhatsApp e distingue devolução do aviso de acesso', async () => {
    io.rows = [{ provider_id: 'invite', status: 'enviado', to_email: io.email, created_at: '2026-10-25T12:00:00Z' }, { provider_id: 'access', status: 'enviado', to_email: io.email, created_at: '2026-10-24T12:00:00Z' }]
    io.provider.mockResolvedValueOnce({ subject: 'Seu convite para o Clube da Construção', event: 'delivered' }).mockResolvedValueOnce({ subject: 'Seu acesso', event: 'bounced' })
    const r = await (await createPlatformOperations('loja')).lookup(io.email)
    expect(r.delivery).toContain('devolvido'); expect(io.provider).toHaveBeenCalledTimes(2)
  })
})
