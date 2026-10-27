import Link from 'next/link'
import type { PurchaseNavigation } from '@/lib/membros/purchase-navigation'

export function PurchaseNavigationLinks({ navigation }: { navigation: PurchaseNavigation }) {
  return <nav aria-label="Materiais adquiridos nesta compra" className="mt-4 min-w-0 space-y-2">
    {navigation.products.map(product => <Link key={product.id} href={product.href} aria-current={product.current ? 'page' : undefined} className={`block min-w-0 rounded-xl border px-3 py-2 lg:px-4 lg:py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque ${product.current ? 'border-destaque/40 bg-superficie-2' : 'border-borda hover:bg-superficie-2'}`}>
      <span className="block text-xs text-texto-suave">{product.role === 'principal' ? 'Principal' : 'Complemento'}</span>
      <span className="mt-1 block break-words [overflow-wrap:anywhere] text-sm font-semibold leading-snug">{product.title}</span>
      <small className="mt-1 block text-xs text-destaque">{product.current ? 'Você está aqui' : 'Adquirido · Acessar material'}</small>
    </Link>)}
  </nav>
}
