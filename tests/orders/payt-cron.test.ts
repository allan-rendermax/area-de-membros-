import { afterEach, expect, it, vi } from 'vitest'
const worker = vi.hoisted(() => vi.fn().mockResolvedValue({ completed: 0, failed: 0 }))
vi.mock('@/lib/orders/payt-inbox-server', () => ({ runPaytInbox: worker }))
import { GET } from '@/app/api/cron/payt-inbox/route'
afterEach(() => { vi.unstubAllEnvs(); worker.mockClear() })
it('recusa cron sem segredo, incorreto ou ausente, e permite somente bearer válido', async () => {
  const req = (token = '') => new Request('https://app.test/api/cron/payt-inbox', { headers: { authorization: token } })
  vi.stubEnv('CRON_SECRET', '')
  expect((await GET(req('Bearer '))).status).toBe(401)
  vi.stubEnv('CRON_SECRET', 'segredo-de-teste')
  expect((await GET(req())).status).toBe(401)
  expect((await GET(req('Bearer segredo-incorreto'))).status).toBe(401)
  expect(worker).not.toHaveBeenCalled()
  expect((await GET(req('Bearer segredo-de-teste'))).status).toBe(200)
  expect(worker).toHaveBeenCalledTimes(1)
})
