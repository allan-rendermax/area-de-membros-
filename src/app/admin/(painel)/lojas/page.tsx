import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listStores } from '@/lib/data/stores'

export default async function LojasPage({ searchParams }: PageProps<'/admin/lojas'>) {
  await requireAdmin()
  const { msg } = await searchParams
  const stores = await listStores()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className={ui.h1}>Lojas</h1>
        <Link href="/admin/lojas/nova" className={ui.button}>Nova loja</Link>
      </div>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr><th className={ui.th}>Nome</th><th className={ui.th}>Endereço</th><th className={ui.th}>WhatsApp</th></tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {stores.map((s) => (
              <tr key={s.id}>
                <td className={ui.td}><Link href={`/admin/lojas/${s.id}`} className="font-medium hover:text-destaque">{s.name}</Link></td>
                <td className={ui.td}><a href={`/${s.slug}`} target="_blank" rel="noopener noreferrer" className="text-texto-suave hover:text-texto">/{s.slug} ↗</a></td>
                <td className={ui.td}>{s.supportWhatsapp ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
