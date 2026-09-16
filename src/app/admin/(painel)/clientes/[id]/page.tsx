import { notFound } from 'next/navigation'
import { getCustomer, listDevices } from '@/lib/data/customers'
import { listOrdersByEmail } from '@/lib/data/orders'
import { alternarBloqueio, corrigirEmail, reenviarAcesso } from '../actions'
import { requireAdmin } from '@/lib/auth/require-admin'

const button = 'rounded-lg px-3 py-2 text-sm font-semibold'

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ msg?: string }>
}) {
  await requireAdmin()
  const [{ id }, { msg }] = await Promise.all([params, searchParams])
  const customer = await getCustomer(id)
  if (!customer) notFound()
  const [orders, devices] = await Promise.all([listOrdersByEmail(customer.email), listDevices(id)])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">{customer.email}</h1>
        <p className="text-zinc-600">{customer.name}</p>
        {msg && <p role="status" className="mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm">{msg}</p>}
      </div>

      <section className="flex flex-wrap gap-2">
        <form action={reenviarAcesso}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={`${button} bg-zinc-900 text-white`}>Reenviar acesso</button>
        </form>
        <form action={alternarBloqueio}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="block" value={customer.blockedAt ? 'false' : 'true'} />
          <button type="submit" className={`${button} ${customer.blockedAt ? 'bg-white ring-1 ring-zinc-300' : 'bg-red-600 text-white'}`}>
            {customer.blockedAt ? 'Desbloquear' : 'Bloquear'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Corrigir email</h2>
        <form action={corrigirEmail} className="flex flex-wrap gap-2">
          <input type="hidden" name="id" value={id} />
          <input name="email" type="email" required defaultValue={customer.email} className="w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2" />
          <button type="submit" className={`${button} bg-white ring-1 ring-zinc-300`}>Salvar email</button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Pedidos</h2>
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
              <span>{o.productName || o.productCode} <span className="text-zinc-400">({o.productCode})</span></span>
              <span>{o.status}</span>
            </li>
          ))}
          {orders.length === 0 && <li className="px-4 py-2 text-zinc-500">Nenhum pedido.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Aparelhos ({devices.length})</h2>
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white text-sm">
          {devices.map((d) => (
            <li key={`${d.userAgent}-${d.firstSeenAt}`} className="px-4 py-2">
              <span className="block truncate">{d.userAgent || 'Desconhecido'}</span>
              <span className="text-zinc-500">
                Último acesso: {new Date(d.lastSeenAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </span>
            </li>
          ))}
          {devices.length === 0 && <li className="px-4 py-2 text-zinc-500">Nenhum acesso registrado.</li>}
        </ul>
      </section>
    </div>
  )
}
