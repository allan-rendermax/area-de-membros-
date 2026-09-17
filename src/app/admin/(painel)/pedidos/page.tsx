import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listOrders, type OrderFilter } from '@/lib/data/orders'

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'problemas', label: 'Reembolsos e chargebacks' },
  { value: 'desconhecidas', label: 'Código sem oferta (todas as lojas)' },
  { value: 'teste', label: 'Teste' },
]

const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-superficie-2 text-texto-suave',
  pago: 'bg-sucesso/15 text-sucesso',
  cancelado: 'bg-superficie-2 text-texto-suave',
  reembolsado: 'bg-alerta/15 text-alerta',
  chargeback: 'bg-destaque/15 text-destaque',
}

export default async function PedidosPage({ searchParams }: PageProps<'/admin/pedidos'>) {
  await requireAdmin()
  const { filtro } = await searchParams
  const filter = FILTERS.find((f) => f.value === filtro)?.value ?? 'todos'
  const store = await getAdminStore()
  const orders = await listOrders(store.id, filter)

  return (
    <div className="flex flex-col gap-4">
      <h1 className={ui.h1}>Pedidos — {store.name}</h1>
      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/admin/pedidos?filtro=${f.value}`} className={ui.chip(f.value === filter)}>{f.label}</Link>
        ))}
      </nav>
      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr><th className={ui.th}>Data</th><th className={ui.th}>Cliente</th><th className={ui.th}>Produto</th><th className={ui.th}>Origem</th><th className={ui.th}>Status</th></tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className={`${ui.td} whitespace-nowrap`}>{new Date(o.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                <td className={ui.td}><Link href={`/admin/clientes?q=${encodeURIComponent(o.customerEmail)}`} className="underline">{o.customerEmail}</Link></td>
                <td className={ui.td}>
                  {o.productName || o.productCode} <span className="text-texto-suave">({o.productCode})</span>
                  {filter === 'desconhecidas' && (
                    <Link href={`/admin/ofertas/novo?codigo=${encodeURIComponent(o.productCode)}`} className="ml-2 text-destaque hover:underline">criar oferta</Link>
                  )}
                  {o.isTest && <span className="ml-2 text-xs text-texto-suave">teste</span>}
                </td>
                <td className={ui.td}>{o.source}</td>
                <td className={ui.td}><span className={`${ui.pill} ${STATUS_STYLE[o.status]}`}>{o.status}</span></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className={`${ui.td} text-texto-suave`}>Nenhum pedido.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
