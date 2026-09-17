import { describe, expect, it } from 'vitest'
import { protectedStoreSlug } from '@/lib/membros/paths'

describe('protectedStoreSlug', () => {
  it('protege vitrine, produto e item da loja', () => {
    expect(protectedStoreSlug('/arquitetura')).toBe('arquitetura')
    expect(protectedStoreSlug('/arquitetura/produto/atlas')).toBe('arquitetura')
    expect(protectedStoreSlug('/arquitetura/item/0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c')).toBe('arquitetura')
  })

  it('não protege login, manifesto, raiz nem rotas reservadas', () => {
    expect(protectedStoreSlug('/arquitetura/entrar')).toBeNull()
    expect(protectedStoreSlug('/arquitetura/manifest.webmanifest')).toBeNull()
    expect(protectedStoreSlug('/')).toBeNull()
    expect(protectedStoreSlug('/admin/pedidos')).toBeNull()
    expect(protectedStoreSlug('/entrar')).toBeNull()
    expect(protectedStoreSlug('/icons/arquitetura/192')).toBeNull()
  })
})
