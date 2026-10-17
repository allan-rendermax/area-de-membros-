import { beforeEach, expect, it, vi } from 'vitest'
import { buildResendNotice, resendAccessForCustomer } from '@/lib/email/server'
const mocks = vi.hoisted(() => ({ store: vi.fn(), send: vi.fn() }))
vi.mock('@/lib/data/stores', () => ({ getStoreById: mocks.store }))
vi.mock('@/lib/data/customers', () => ({ getCustomer: async () => ({ id: 'c', email: 'student@example.test', name: 'Student', blockedAt: null }) }))
vi.mock('@/lib/data/access', () => ({ loadStoreAccess: async () => ({ products: [{ id: 'p', title: 'Product', isPublished: true, sortOrder: 0 }], granted: new Set(['p']) }) }))
vi.mock('@/lib/data/email-log', () => ({ countEmailsUsedToday: async () => 0, createEmailLogRepo: () => ({}), getEmailLogEntry: vi.fn(), listUnresolvedFailed: vi.fn(), markEmailsResolved: vi.fn() }))
vi.mock('@/lib/email/notifier', () => ({ sendAccessNotice: mocks.send }))
vi.mock('@/lib/email/resend-transport', () => ({ createResendTransport: () => ({}) }))
beforeEach(() => { mocks.send.mockReset(); mocks.send.mockResolvedValue({ ok: true, logId: 'l' }) })
it.each(['https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t', null, undefined])('propagates configuration in individual and batch resend notices %s', async value => {
  mocks.store.mockResolvedValue({ id: 's', slug: 'loja', name: 'Loja', communityWhatsappUrl: value })
  await expect(resendAccessForCustomer('c', 's')).resolves.toEqual({ ok: true })
  expect(mocks.send.mock.calls[0][0].store).toEqual({ id: 's', slug: 'loja', name: 'Loja', communityWhatsappUrl: value ?? null })
  expect((await buildResendNotice({ customerId: 'c', storeId: 's' }))?.store.communityWhatsappUrl).toBe(value ?? null)
})

vi.mock('@/lib/env', () => ({ env: { appUrl: 'https://members.example.test', emailFrom: 'test@example.test', emailReplyTo: 'support@example.test', emailDailyLimit: 100 } }))
