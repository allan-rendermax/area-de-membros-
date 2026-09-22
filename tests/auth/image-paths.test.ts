// Next 16.3.5 documents this API as unstable_doesProxyMatch, but its CommonJS
// entry point still exposes the previous export name.
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from 'next/experimental/testing/server'
import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config'
import { config } from '@/proxy'

describe('matcher do proxy para imagens públicas', () => {
  it.each(['/covers/a.avif', '/covers/a.jpg'])('não executa o proxy em %s', (url) => {
    expect(unstable_doesProxyMatch({ config, nextConfig, url })).toBe(false)
  })

  it.each(['/arquitetura/produto/atlas', '/admin/produtos'])('continua executando o proxy em %s', (url) => {
    expect(unstable_doesProxyMatch({ config, nextConfig, url })).toBe(true)
  })
})
