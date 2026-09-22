import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { AutoCover } from '@/components/membros/auto-cover'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listProducts } from '@/lib/data/products'

export default async function ProdutosPage() {
  await requireAdmin()
  const store = await getAdminStore()
  const products = await listProducts(store.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className={ui.h1}>Produtos — {store.name}</h1>
        <Link href="/admin/produtos/novo" className={ui.button}>Novo produto</Link>
      </div>
      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr>
              <th className={ui.th}>Capa</th><th className={ui.th}>Título</th><th className={ui.th}>Trilha</th><th className={ui.th}>Endereço</th>
              <th className={ui.th}>Ordem</th><th className={ui.th}>Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {products.map((p) => (
              <tr key={p.id}>
                <td className={ui.td}><div className="w-10"><AutoCover seed={p.id} title="" imageUrl={p.coverUrl} aspect="poster" /></div></td>
                <td className={ui.td}><Link href={`/admin/produtos/${p.id}`} className="font-medium hover:text-destaque">{p.title}</Link></td>
                <td className={ui.td}>{p.track || '—'}</td>
                <td className={`${ui.td} text-texto-suave`}>/{p.slug}</td>
                <td className={ui.td}>{p.sortOrder}</td>
                <td className={ui.td}>
                  <span className={`${ui.pill} ${p.isPublished ? 'bg-sucesso/15 text-sucesso' : 'bg-superficie-2 text-texto-suave'}`}>{p.isPublished ? 'Publicado' : 'Oculto'}</span>
                  {p.isFeatured && <span className={`${ui.pill} ml-2 bg-destaque/15 text-destaque`}>Destaque</span>}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} className={`${ui.td} text-texto-suave`}>Nenhum produto nesta loja.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
