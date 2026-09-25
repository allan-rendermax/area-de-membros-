import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { createFixture, id } from '../../scripts/qa-members-browser-fixture.mjs'
import { listRecentMaterials } from '@/lib/data/item-access'
import { resourceLabel } from '@/lib/content/resource-label'
import type { AddressInfo } from 'node:net'

const provider = vi.hoisted(() => ({ url: '' }))
vi.mock('@/lib/supabase/admin', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return { createAdminClient: () => createClient(provider.url, 'fixture-service-key', { auth: { persistSession: false } }) }
})

const { server, tables } = createFixture()
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  provider.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => { await new Promise((resolve) => server.close(resolve)) })

test('seeded file is recognized by actual recent-material query and format labels', async () => {
  const recent = await listRecentMaterials(id(1), id(3), new Set([id(10), id(11)]))
  expect(recent).toEqual([expect.objectContaining({ itemId: id(31), kind: 'arquivo' })])
  for (const item of tables.items.filter((item) => /\.(pdf|zip)$/.test(String(item.url)))) {
    expect(item.kind).toBe('arquivo')
    expect(resourceLabel({ kind: 'arquivo', url: String(item.url) })).toEqual({ typeLabel: expect.stringMatching(/^(PDF|ZIP)$/), actionLabel: 'Acesse seu conteúdo' })
  }
  expect(tables.item_access[0].kind).toBe('arquivo')
  expect(await listRecentMaterials(id(2), id(3), new Set())).toEqual([])
})
