import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listStores } from '@/lib/data/stores'
import { trocarLoja } from './loja-actions'

export const dynamic = 'force-dynamic'

const links = [
  { href: '/admin/sucesso', label: 'Sucesso' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/ofertas', label: 'Ofertas' },
  { href: '/admin/avisos', label: 'Avisos Payt' },
  { href: '/admin/emails', label: 'E-mails' },
  { href: '/admin/lojas', label: 'Lojas' },
]

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin()
  const [store, stores] = await Promise.all([getAdminStore(), listStores()])

  return (
    <div className="min-h-dvh bg-fundo text-texto">
      <header className="border-b border-borda bg-superficie">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <span className="font-bold">Admin</span>
          <form action={trocarLoja} className="flex items-center gap-2">
            <label htmlFor="admin-loja" className="sr-only">Loja</label>
            <select id="admin-loja" name="slug" defaultValue={store.slug} className={`${ui.input} py-1.5 text-sm`}>
              {stores.map((s) => (
                <option key={s.id} value={s.slug}>{s.name}</option>
              ))}
            </select>
            <button type="submit" className={ui.buttonGhost}>Trocar</button>
          </form>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-texto-suave hover:text-texto">{l.label}</Link>
            ))}
          </nav>
          <a href={`/${store.slug}?previa=1`} target="_blank" rel="noopener noreferrer" className={ui.buttonGhost}>Visualizar como aluno ↗</a>
          <form action="/sair?para=admin" method="post" className="ml-auto flex items-center gap-3 text-sm text-texto-suave">
            <span className="hidden sm:inline">{email}</span>
            <button type="submit" className="hover:text-texto">Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
