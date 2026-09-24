// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import ClienteVitrinePage from '@/app/admin/(painel)/clientes/[id]/vitrine/page'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/clientes/00000000-0000-4000-8000-000000000001/vitrine',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error('not found') },
}))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: async () => {} }))
vi.mock('@/lib/admin/current-store', () => ({ getAdminStore: async () => ({ id: 'store', name: 'Loja' }) }))
vi.mock('@/lib/data/customers', () => ({ getCustomer: async () => ({ id: 'customer', email: 'aluno@example.test' }) }))
vi.mock('@/lib/data/item-access', () => ({ listRecentProductIds: async () => [] }))
vi.mock('@/lib/data/access', () => ({ loadStoreAccess: async () => ({
  granted: new Set(),
  products: [{ id: 'p', storeId: 'store', slug: 'atlas', title: 'Atlas', track: '', description: '',
    coverUrl: null, bannerUrl: null, checkoutUrl: 'https://checkout.example.test/normal',
    studentCheckoutUrl: 'https://checkout.example.test/coupon?coupon=ALUNO10',
    isFeatured: false, sortOrder: 0, isPublished: true }],
}) }))

describe('preview da vitrine', () => {
  it('não oferece nenhum checkout ao abrir o produto bloqueado', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    try {
      const page = await ClienteVitrinePage({ params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) })
      await act(async () => { root.render(page) })
      const trigger = host.querySelector<HTMLButtonElement>('button[aria-label*="bloqueado"]')!
      act(() => trigger.click())
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
      expect(dialog.textContent).toContain('Este material ainda não está disponível para compra.')
      expect(dialog.querySelector('a[href]')).toBeNull()
      expect(dialog.textContent).not.toContain('10%')
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })
})
