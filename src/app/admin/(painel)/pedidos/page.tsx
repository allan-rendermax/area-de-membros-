import Link from 'next/link'
import { listOrders, type OrderFilter } from '@/lib/data/orders'
import { getDefaultStore } from '@/lib/data/stores'

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'problemas', label: 'Reembolsos e chargebacks' },
  { value: 'desconhecidas', label: 'Oferta não cadastrada' },
  { value: 'teste', label: 'Teste' },
]

const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-zinc-100 text-zinc-700',
  pago: 'bg-green-100 text-green-800',
  cancelado: 'bg-zinc-200 text-zinc-700',
  reembolsado: 'bg-amber-100 text-amber-800',
  chargeback: 'bg-red-100 text-red-800',
}

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams
  const filter = FILTERS.some((f) => f.value === filtro) ? (filtro as OrderFilter) : 'todos'
  const store = await getDefaultStore()
  const orders = await listOrders(store.id, filter)

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Pedidos</h1>
      <nav className="mb-4 flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/pedidos?filtro=${f.value}`}
            className={`rounded-full px-3 py-1 ${f.value === filter ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-200'}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Produto</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="whitespace-nowrap px-4 py-2">{new Date(o.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                <td className="px-4 py-2">
                  <Link href={`/admin/clientes?q=${encodeURIComponent(o.customerEmail)}`} className="underline">{o.customerEmail}</Link>
                </td>
                <td className="px-4 py-2">
                  {o.productName || o.productCode} <span className="text-zinc-400">({o.productCode})</span>
                  {o.isTest && <span className="ml-2 text-xs text-zinc-500">teste</span>}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}>{o.status}</span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-3 text-zinc-500">Nenhum pedido.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
