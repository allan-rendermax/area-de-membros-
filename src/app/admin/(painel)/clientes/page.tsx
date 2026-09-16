import Link from 'next/link'
import { SHARING_DEVICE_THRESHOLD, searchCustomers } from '@/lib/data/customers'

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams
  const customers = await searchCustomers(q.trim().toLowerCase())

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Clientes</h1>
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por email" className="w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2" />
        <button type="submit" className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">Buscar</button>
      </form>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/clientes/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>{c.email} <span className="text-sm text-zinc-500">{c.name}</span></span>
              <span className="flex gap-2 text-xs">
                {c.recentDevices >= SHARING_DEVICE_THRESHOLD && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{c.recentDevices} aparelhos</span>
                )}
                {c.blockedAt && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">bloqueado</span>}
              </span>
            </Link>
          </li>
        ))}
        {customers.length === 0 && <li className="px-4 py-3 text-zinc-500">Nenhum cliente encontrado.</li>}
      </ul>
    </div>
  )
}
