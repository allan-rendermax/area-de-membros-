import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { formatDateTime } from '@/lib/admin/labels'
import { canRevoke } from '@/lib/admin/manual-access'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { getCustomer, listDevices } from '@/lib/data/customers'
import { listOrdersByEmail } from '@/lib/data/orders'
import { listOffers } from '@/lib/data/products-admin'
import { listEmailsForCustomer, listItemOpensForCustomer } from '@/lib/data/success'
import { buildTimeline } from '@/lib/success/timeline'
import { alternarBloqueio, corrigirEmail, liberarAcessoManual, reenviarAcesso, removerAcessoManual } from '../actions'

const KIND_STYLE: Record<string, string> = {
  pedido: 'bg-sucesso/15 text-sucesso',
  email: 'bg-alerta/15 text-alerta',
  acesso: 'bg-superficie-2 text-texto',
  item: 'bg-destaque/15 text-destaque',
}

export default async function ClientePage({ params, searchParams }: PageProps<'/admin/clientes/[id]'>) {
  await requireAdmin()
  const [{ id }, { msg }] = await Promise.all([params, searchParams])
  if (!isUuid(id)) notFound()
  const customer = await getCustomer(id)
  if (!customer) notFound()

  const store = await getAdminStore()
  const [orders, devices, emails, itemOpens, offers] = await Promise.all([
    listOrdersByEmail(customer.email),
    listDevices(id),
    listEmailsForCustomer(id),
    listItemOpensForCustomer(id),
    listOffers(store.id),
  ])
  const timeline = buildTimeline({ orders, emails, devices, itemOpens })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className={ui.h1}>{customer.email}</h1>
        <p className="text-texto-suave">{customer.name}</p>
        {typeof msg === 'string' && <p role="status" className={`${ui.notice} mt-2`}>{msg}</p>}
      </div>

      <section className="flex flex-wrap gap-2">
        <Link href={`/admin/clientes/${id}/vitrine`} className={ui.buttonGhost}>Ver como aluno</Link>
        <form action={reenviarAcesso}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={ui.button}>Reenviar acesso</button>
        </form>
        <form action={alternarBloqueio}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="block" value={customer.blockedAt ? 'false' : 'true'} />
          <button type="submit" className={customer.blockedAt ? ui.buttonGhost : ui.buttonDanger}>{customer.blockedAt ? 'Desbloquear' : 'Bloquear'}</button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Corrigir e-mail</h2>
        <form action={corrigirEmail} className="flex flex-wrap gap-2">
          <input type="hidden" name="id" value={id} />
          <input name="email" type="email" required defaultValue={customer.email} className={`${ui.input} w-full max-w-sm`} />
          <button type="submit" className={ui.buttonGhost}>Salvar e-mail</button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Acesso manual</h2>
        <form action={liberarAcessoManual} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={id} />
          <label className="flex w-full max-w-sm flex-col gap-1 text-sm">
            Oferta
            <select name="offerId" required defaultValue="" className={ui.input} disabled={offers.length === 0}>
              <option value="" disabled>Selecione uma oferta</option>
              {offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.name} ({offer.paytProductCode})</option>)}
            </select>
          </label>
          <label className="flex w-full max-w-sm flex-col gap-1 text-sm">
            Motivo (opcional)
            <input type="text" name="note" className={ui.input} />
          </label>
          <button type="submit" className={ui.button} disabled={offers.length === 0}>Liberar acesso</button>
        </form>
        {offers.length === 0 && <p className="mt-2 text-sm text-texto-suave">Nenhuma oferta cadastrada na loja atual.</p>}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Pedidos</h2>
        <ul className={`${ui.card} divide-y divide-borda text-sm`}>
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span>{order.productName || order.productCode} ({order.productCode}) — {order.status}</span>
                  {order.source === 'manual' && <span className={`${ui.pill} bg-sucesso/15 text-sucesso`}>manual</span>}
                </p>
                <p className="text-texto-suave">{formatDateTime(order.createdAt)}</p>
                {order.source === 'manual' && (
                  <>
                    {order.note && <p className="whitespace-pre-wrap break-words">Motivo: {order.note}</p>}
                    {order.createdBy && <p className="break-words text-texto-suave">Liberado por: {order.createdBy}</p>}
                  </>
                )}
              </div>
              {order.storeId === store.id && canRevoke(order) && (
                <form action={removerAcessoManual}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="orderId" value={order.id} />
                  <button type="submit" className={ui.buttonDanger}>Remover acesso</button>
                </form>
              )}
            </li>
          ))}
          {orders.length === 0 && <li className="px-4 py-3 text-texto-suave">Nenhum pedido registrado.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Linha do tempo</h2>
        <ol className={`${ui.card} divide-y divide-borda`}>
          {timeline.map((event, index) => (
            <li key={`${event.at}-${index}`} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
              <span className="w-40 shrink-0 text-texto-suave">{formatDateTime(event.at)}</span>
              <span className={`${ui.pill} ${KIND_STYLE[event.kind]}`}>{event.kind}</span>
              <span className="flex-1">{event.title}</span>
              {event.detail && <span className="text-texto-suave">{event.detail}</span>}
            </li>
          ))}
          {timeline.length === 0 && <li className="px-4 py-2 text-sm text-texto-suave">Sem eventos registrados.</li>}
        </ol>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Aparelhos ({devices.length})</h2>
        <ul className={`${ui.card} divide-y divide-borda text-sm`}>
          {devices.map((d) => (
            <li key={`${d.userAgent}-${d.firstSeenAt}`} className="px-4 py-2">
              <span className="block truncate">{d.userAgent || 'Desconhecido'}</span>
              <span className="text-texto-suave">Último acesso: {formatDateTime(d.lastSeenAt)}</span>
            </li>
          ))}
          {devices.length === 0 && <li className="px-4 py-2 text-texto-suave">Nenhum acesso registrado.</li>}
        </ul>
      </section>
    </div>
  )
}
