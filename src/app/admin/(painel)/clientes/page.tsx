import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { SHARING_DEVICE_THRESHOLD, searchCustomers } from '@/lib/data/customers'

export default async function ClientesPage({ searchParams }: PageProps<'/admin/clientes'>) {
  await requireAdmin()
  const { q, msg } = await searchParams
  const query = typeof q === 'string' ? q.trim().toLowerCase() : ''
  const customers = await searchCustomers(query)

  return (
    <div className="flex flex-col gap-4">
      <h1 className={ui.h1}>Clientes</h1>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      <form className="flex gap-2">
        <input name="q" defaultValue={query} placeholder="Buscar por e-mail" className={`${ui.input} w-full max-w-sm`} />
        <button type="submit" className={ui.button}>Buscar</button>
      </form>
      <ul className={`${ui.card} divide-y divide-borda`}>
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/clientes/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-superficie-2">
              <span>{c.email} <span className="text-sm text-texto-suave">{c.name}</span></span>
              <span className="flex gap-2">
                {c.recentDevices >= SHARING_DEVICE_THRESHOLD && <span className={`${ui.pill} bg-alerta/15 text-alerta`}>{c.recentDevices} aparelhos</span>}
                {c.blockedAt && <span className={`${ui.pill} bg-destaque/15 text-destaque`}>bloqueado</span>}
              </span>
            </Link>
          </li>
        ))}
        {customers.length === 0 && <li className="px-4 py-3 text-texto-suave">Nenhum cliente encontrado.</li>}
      </ul>
    </div>
  )
}
