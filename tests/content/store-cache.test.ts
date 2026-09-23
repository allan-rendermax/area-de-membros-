import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStoreBySlug } from '@/lib/data/stores'

const doubles = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  entries: new Map<string, { tag: string; value: unknown }>(),
  options: [] as unknown[],
  updateTag: vi.fn((tag: string) => {
    for (const [key, entry] of doubles.entries) {
      if (entry.tag === tag) doubles.entries.delete(key)
    }
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: doubles.createAdminClient }))
vi.mock('next/cache', () => ({
  unstable_cache: <T extends (slug: string) => Promise<unknown>>(
    load: T,
    keyParts: string[],
    options: { tags: string[]; revalidate: number },
  ) => {
    doubles.options.push(options)
    return async (slug: string) => {
      const key = JSON.stringify([keyParts, slug])
      if (doubles.entries.has(key)) return doubles.entries.get(key)!.value
      const value = await load(slug)
      doubles.entries.set(key, { tag: options.tags[0], value })
      return value
    }
  },
  updateTag: doubles.updateTag,
}))

const storeA = {
  id: 'store-a', slug: 'loja-a', name: 'Loja A', logo_url: null,
  support_url: null, support_whatsapp: null, login_image_url: null,
}
const storeB = { ...storeA, id: 'store-b', slug: 'loja-b', name: 'Loja B' }

const expectedA = {
  id: 'store-a', slug: 'loja-a', name: 'Loja A', logoUrl: null,
  supportUrl: null, supportWhatsapp: null, loginImageUrl: null,
}
const expectedB = { ...expectedA, id: 'store-b', slug: 'loja-b', name: 'Loja B' }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function useStores(rows: typeof storeA[], fail = false) {
  const requests: Request[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request)
    if (fail) return json({ message: 'lojas indisponíveis', code: 'XX000', details: null, hint: null }, 500)
    const slug = new URL(request.url).searchParams.get('slug')?.replace(/^eq\./, '')
    return json(rows.find((row) => row.slug === slug) ?? null)
  })
  doubles.createAdminClient.mockImplementation(() => createClient('https://project.supabase.co', 'service-role-test', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  }))
  return requests
}

describe('cache público de lojas por slug', () => {
  beforeEach(() => {
    doubles.entries.clear()
    doubles.createAdminClient.mockReset()
    doubles.updateTag.mockClear()
  })

  it('usa a política pública e separa slugs no cache', async () => {
    const requests = useStores([storeA, storeB])

    expect(await getStoreBySlug('loja-a')).toEqual(expectedA)
    expect(await getStoreBySlug('loja-a')).toEqual(expectedA)
    expect(requests).toHaveLength(1)
    expect(await getStoreBySlug('loja-b')).toEqual(expectedB)
    expect(requests).toHaveLength(2)
    expect(new URL(requests[0].url).searchParams.get('slug')).toBe('eq.loja-a')
    expect(new URL(requests[1].url).searchParams.get('slug')).toBe('eq.loja-b')
    expect(doubles.options).toEqual([{ tags: ['public-stores'], revalidate: 300 }])
  })

  it('guarda resultado ausente e consulta novamente após invalidação', async () => {
    const rows = [storeA]
    const requests = useStores(rows)

    expect(await getStoreBySlug('loja-b')).toBeNull()
    rows.push(storeB)
    expect(await getStoreBySlug('loja-b')).toBeNull()
    expect(requests).toHaveLength(1)

    doubles.updateTag('public-stores')
    expect(await getStoreBySlug('loja-b')).toEqual(expectedB)
    expect(requests).toHaveLength(2)
  })

  it('propaga erro do Supabase e não guarda falha', async () => {
    const requests = useStores([], true)

    await expect(getStoreBySlug('loja-a')).rejects.toMatchObject({ message: 'lojas indisponíveis', code: 'XX000' })
    await expect(getStoreBySlug('loja-a')).rejects.toMatchObject({ message: 'lojas indisponíveis', code: 'XX000' })
    expect(requests).toHaveLength(2)
  })

  it('refaz consulta e entrega os dados atualizados após invalidação', async () => {
    const rows = [storeA]
    const requests = useStores(rows)

    expect(await getStoreBySlug('loja-a')).toEqual(expectedA)
    rows[0] = { ...storeA, name: 'Loja A renovada' }
    expect(await getStoreBySlug('loja-a')).toEqual(expectedA)
    doubles.updateTag('public-stores')
    expect(await getStoreBySlug('loja-a')).toEqual({ ...expectedA, name: 'Loja A renovada' })
    expect(requests).toHaveLength(2)
  })
})
