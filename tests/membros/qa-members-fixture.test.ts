import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { createFixture, id } from '../../scripts/qa-members-browser-fixture.mjs'
import { recordLoginAttempt, countLoginAttemptsByEmailHash } from '@/lib/data/login-attempts'
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


test('fixture oferece Básico, Completo e sem compra com versions e checkouts só locais', () => {
  expect(tables.products.find((p) => p.id === id(10))?.content_mode).toBe('versions')
  expect(tables.offers.flatMap((offer) => offer.offer_products).map((link) => link.grant_level)).toContain('basic')
  expect(tables.offers.flatMap((offer) => offer.offer_products).map((link) => link.grant_level)).toContain('complete')
  expect(tables.customers.map((c) => c.email)).toEqual(expect.arrayContaining(['aluno@example.test', 'completo@example.test', 'vazio@example.test']))
  expect(tables.products.every((p) => p.checkout_url?.startsWith('http://127.0.0.1:'))).toBe(true)
})

test('falha de histórico é controlada apenas no provedor fictício', async () => {
  const headers = { 'content-type': 'application/json', apikey: 'fixture-service-key' }
  const control = await fetch(`${provider.url}/__qa/history`, { method: 'POST', headers, body: JSON.stringify({ fail: true, delayMs: 0 }) })
  expect(control.status).toBe(200)
  try {
    const result = await fetch(`${provider.url}/rest/v1/item_access`, { method: 'POST', headers, body: JSON.stringify({ customer_id: id(1) }) })
    expect(result.status).toBe(503)
  } finally { await fetch(`${provider.url}/__qa/history`, { method: 'POST', headers, body: JSON.stringify({ fail: false, delayMs: 0 }) }) }
})

test('assina arquivo privado somente com chave fictícia e aponta ao próprio provedor', async () => {
  const url = `${provider.url}/storage/v1/object/sign/arquivos-restritos/qa/modelo.pdf`
  const denied = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  expect(denied.status).toBe(401)
  const signed = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', apikey: 'fixture-service-key' }, body: JSON.stringify({ expiresIn: 60 }) })
  expect(signed.status).toBe(200)
  expect((await signed.json()).signedURL).toBe('/object/sign/arquivos-restritos/qa/modelo.pdf?token=fixture-only')
})


test('fixture permite ler trilhas do editor administrativo com filtro neq', async () => {
  const response = await fetch(`${provider.url}/rest/v1/products?select=track&store_id=eq.${id(3)}&track=neq.`, { headers: { apikey: 'fixture-service-key' } })
  expect(response.status).toBe(200)
  expect((await response.json()).length).toBeGreaterThan(0)
})


test('fixture recebe quatro uploads individuais de 1,6 MB e confirma tamanho/MIME', async () => {
  const admin = createClient(provider.url, 'fixture-service-key', { auth: { persistSession: false } })
  const browser = createClient(provider.url, 'fixture-publishable-key', { auth: { persistSession: false } })
  for (const slot of ['cover', 'banner', 'purchase', 'upgrade']) {
    const path = `product-drafts/${slot}.png`
    const ticket = await admin.storage.from('covers').createSignedUploadUrl(path)
    expect(ticket.error).toBeNull()
    const result = await browser.storage.from('covers').uploadToSignedUrl(path, ticket.data!.token, new Blob([new Uint8Array(1_600_000)], { type: 'image/png' }))
    expect(result.error).toBeNull()
    const info = await admin.storage.from('covers').info(path)
    expect(info.error).toBeNull()
    expect(info.data).toMatchObject({ size: 1_600_000, contentType: 'image/png' })
  }
})

test('fixture conserva uploads anteriores quando terceiro envio falha', async () => {
  const admin = createClient(provider.url, 'fixture-service-key', { auth: { persistSession: false } })
  await fetch(`${provider.url}/__qa/uploads`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ failOn: 3 }) })
  try {
    for (let i = 1; i <= 3; i++) {
      const path = `product-drafts/partial-${i}.png`
      const ticket = await admin.storage.from('covers').createSignedUploadUrl(path)
      const result = await admin.storage.from('covers').uploadToSignedUrl(path, ticket.data!.token, new Blob(['test'], { type: 'image/png' }))
      expect(Boolean(result.error)).toBe(i === 3)
    }
    expect((await admin.storage.from('covers').info('product-drafts/partial-1.png')).data?.size).toBe(4)
    expect((await admin.storage.from('covers').info('product-drafts/partial-2.png')).data?.size).toBe(4)
  } finally { await fetch(`${provider.url}/__qa/uploads`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }) }
})

test('fixture PATCH conserva dados salvos em slug duplicado e aceita atualização válida', async () => {
  const db = createClient(provider.url, 'fixture-service-key', { auth: { persistSession: false } })
  const before = { ...tables.products[0] }
  const failed = await db.from('products').update({ title: 'Rascunho', slug: 'projetos-qa' }).eq('id', id(10)).select('id').single()
  expect(failed.error?.code).toBe('23505')
  expect(tables.products[0]).toEqual(before)
  const saved = await db.from('products').update({ description: 'Descrição local atualizada' }).eq('id', id(10)).select('id').single()
  expect(saved.error).toBeNull()
  expect(saved.data?.id).toBe(id(10))
  expect(tables.products[0].description).toBe('Descrição local atualizada')
})


test('fixture grava tentativa pelo RPC de login real e permite contagem por hash', async () => {
  await expect(recordLoginAttempt({ ip: '127.0.0.1', emailHash: 'fixture-login-hash', storeId: id(3), email: ' ALUNO@example.test ' })).resolves.toBeUndefined()
  expect(tables.login_attempts.at(-1)).toMatchObject({ ip: '127.0.0.1', email_hash: 'fixture-login-hash', store_id: id(3), customer_id: id(1) })
  expect(await countLoginAttemptsByEmailHash('fixture-login-hash', '2026-01-01T00:00:00Z')).toBe(1)
  const denied = await fetch(`${provider.url}/rest/v1/rpc/record_login_attempt_atomic`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  expect(denied.status).toBe(401)
})
