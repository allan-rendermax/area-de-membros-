import { describe, expect, it } from 'vitest'
import { isLegacyPublicFileUrl, privateFilePath, privateFileUrl } from '@/lib/content/private-files'

const origin = 'https://project.supabase.co'

describe('private file references', () => {
  it('round trips spaces, hashes and percent signs with segment encoding', () => {
    const path = 'Pasta A/guia #1 100%.pdf'
    const url = privateFileUrl(origin, path)
    expect(url).toBe(`${origin}/storage/v1/object/authenticated/arquivos-restritos/Pasta%20A/guia%20%231%20100%25.pdf`)
    expect(privateFilePath(url, origin)).toBe(path)
  })

  it.each(['../secret', 'a/../secret', '/absolute', 'a//b', 'a/./b', 'a\\b'])('rejects invalid path %s', (path) => {
    expect(() => privateFileUrl(origin, path)).toThrow()
  })

  it('rejects foreign origins, userinfo, wrong buckets and traversal references', () => {
    expect(privateFilePath('https://evil.example/storage/v1/object/authenticated/arquivos-restritos/a.pdf', origin)).toBeNull()
    expect(privateFilePath('https://user@project.supabase.co/storage/v1/object/authenticated/arquivos-restritos/a.pdf', origin)).toBeNull()
    expect(privateFilePath(`${origin}/storage/v1/object/authenticated/other/a.pdf`, origin)).toBeNull()
    expect(privateFilePath(`${origin}/storage/v1/object/authenticated/arquivos-restritos/%2e%2e/a.pdf`, origin)).toBeNull()
  })

  it('recognizes only own legacy public files', () => {
    expect(isLegacyPublicFileUrl(`${origin}/storage/v1/object/public/arquivos/a.pdf`, origin)).toBe(true)
    expect(isLegacyPublicFileUrl('https://evil.example/storage/v1/object/public/arquivos/a.pdf', origin)).toBe(false)
    expect(isLegacyPublicFileUrl(`${origin}/storage/v1/object/public/other/a.pdf`, origin)).toBe(false)
  })
})
