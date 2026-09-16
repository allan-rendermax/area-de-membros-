import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'

export const dynamic = 'force-dynamic'

const links = [
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/materiais', label: 'Materiais' },
  { href: '/admin/ofertas', label: 'Ofertas' },
]

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin()
  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-bold">Admin</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-zinc-700 hover:text-zinc-950">{l.label}</Link>
            ))}
          </nav>
          <form action="/sair?para=admin" method="post" className="ml-auto flex items-center gap-3 text-sm text-zinc-500">
            <span className="hidden sm:inline">{email}</span>
            <button type="submit">Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
