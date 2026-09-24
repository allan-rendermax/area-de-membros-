import { beforeEach, expect, it, vi } from 'vitest'
import { recordLoginAttempt } from '@/lib/data/login-attempts'
const io = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => io }))
beforeEach(() => { vi.resetAllMocks(); io.rpc.mockResolvedValue({ error: null }) })
it('vincula tentativa ao cliente no mesmo statement que registra o hash', async () => {
  await recordLoginAttempt({ ip: '1.1.1.1', emailHash: 'hash', storeId: 'store', email: 'cliente@example.test' })
  expect(io.rpc).toHaveBeenCalledExactlyOnceWith('record_login_attempt_atomic', {
    p_ip: '1.1.1.1', p_email_hash: 'hash', p_store_id: 'store', p_email: 'cliente@example.test',
  })
  expect(io.from).not.toHaveBeenCalled()
})
it('permite tentativa anônima sem inventar identidade', async () => {
  await recordLoginAttempt({ ip: '1.1.1.1', emailHash: null, storeId: 'store' })
  expect(io.rpc).toHaveBeenCalledWith('record_login_attempt_atomic', expect.objectContaining({ p_email: null, p_email_hash: null }))
})
