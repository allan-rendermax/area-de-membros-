import { createClient } from '@supabase/supabase-js'
import { beforeEach, expect, it, vi } from 'vitest'
import { getStoreById, listStores, saveStore } from '@/lib/data/stores'
import { findStoreForProductCode } from '@/lib/data/products'
const doubles = vi.hoisted(() => ({ client: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: doubles.client }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
const invite = 'https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t'
const row = { id: 'a', slug: 'loja-a', name: 'A', logo_url: null, support_url: null, support_whatsapp: null, login_image_url: null, community_whatsapp_url: invite }
let requests: Request[]
let response: unknown
let status: number
beforeEach(() => {
  requests = []; response = row; status = 200
  doubles.client.mockImplementation(() => createClient('https://project.supabase.co', 'test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    requests.push(new Request(input, init))
    return new Response(JSON.stringify(response), { status, headers: { 'content-type': 'application/json' } })
  } } }))
})
it('selects community configuration and keeps stores independent', async () => {
  expect((await getStoreById('a'))?.communityWhatsappUrl).toBe(invite)
  expect(new URL(requests[0].url).searchParams.get('select')).toContain('community_whatsapp_url')
  response = [row, { ...row, id: 'b', community_whatsapp_url: null }]
  expect((await listStores()).map(s => s.communityWhatsappUrl)).toEqual([invite, null])
})
it.each([invite, null])('persists community configuration %s', async value => {
  response = { id: 'new' }
  expect(await saveStore({ id: null, slug: 'new', name: 'New', logoUrl: null, supportUrl: null, supportWhatsapp: null, loginImageUrl: null, communityWhatsappUrl: value })).toBe('new')
  expect(await requests[0].json()).toMatchObject({ community_whatsapp_url: value })
})
it('maps nested offer store and includes the column', async () => {
  response = { stores: row }
  expect(await findStoreForProductCode('CODE')).toEqual({ id: 'a', slug: 'loja-a', name: 'A', communityWhatsappUrl: invite })
  expect(new URL(requests[0].url).searchParams.get('select')).toBe('stores(id,slug,name,community_whatsapp_url)')
  response = { stores: { ...row, community_whatsapp_url: null } }
  expect((await findStoreForProductCode('OTHER'))?.communityWhatsappUrl).toBeNull()
  response = { stores: null }
  expect(await findStoreForProductCode('NONE')).toBeNull()
  response = null
  expect(await findStoreForProductCode('NONE')).toBeNull()
  response = { message: 'unavailable', code: 'XX000' }; status = 500
  await expect(findStoreForProductCode('FAIL')).rejects.toMatchObject({ message: 'unavailable' })
})

it.each([invite, null])('updates an existing store to configuration %s', async value => {
  const original = doubles.client.getMockImplementation()!
  doubles.client.mockImplementation(() => {
    response = requests.length === 0 ? row : { id: 'a' }
    return original()
  })
  expect(await saveStore({ id: 'a', slug: 'loja-a', name: 'A', logoUrl: null, supportUrl: null, supportWhatsapp: null, loginImageUrl: null, communityWhatsappUrl: value })).toBe('a')
  expect(requests[1].method).toBe('PATCH')
  expect(await requests[1].json()).toMatchObject({ community_whatsapp_url: value })
})

vi.mock('@/lib/env', () => ({ env: { defaultStoreSlug: 'arquitetura' } }))
