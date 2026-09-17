import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { formatDateTime, SUCCESS_STATUS_LABEL, SUCCESS_STATUS_STYLE } from '@/lib/admin/labels'
import { requireAdmin } from '@/lib/auth/require-admin'
import { countFailedEmailsSince, loadSuccessRows } from '@/lib/data/success'
import { classifyCustomer, summarizeSuccess, type SuccessStatus } from '@/lib/success/classify'
import { parsePage, parsePeriod, periodWindow } from '@/lib/success/period'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const STATUS_FILTERS: ('todos' | SuccessStatus)[] = ['todos', 'nunca_entrou', 'nao_abriu', 'ativo', 'inativo']

export default async function SucessoPage({ searchParams }: PageProps<'/admin/sucesso'>) {
  await requireAdmin()
  const { periodo, filtro, q, pagina } = await searchParams
  const days = parsePeriod(periodo)
  const status = STATUS_FILTERS.find((s) => s === filtro) ?? 'todos'
  const query = typeof q === 'string' ? q.trim().toLowerCase() : ''

  const store = await getAdminStore()
  const { now, sinceIso } = periodWindow(days)
  const [rows, failedEmails] = await Promise.all([loadSuccessRows(store.id), countFailedEmailsSince(store.id, sinceIso)])
  const overview = summarizeSuccess(rows, now, days)

  const filtered = rows
    .map((r) => ({ ...r, status: classifyCustomer(r, now) }))
    .filter((r) => status === 'todos' || r.status === status)
    .filter((r) => !query || r.email.includes(query))
    .sort((a, b) => Date.parse(b.firstPaidAt) - Date.parse(a.firstPaidAt))
  const page = parsePage(pagina, filtered.length, PAGE_SIZE)
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const href = (changes: Record<string, string | number>) => {
    const params = new URLSearchParams({ periodo: String(days), filtro: status, q: query, pagina: '0' })
    for (const [key, value] of Object.entries(changes)) params.set(key, String(value))
    return `/admin/sucesso?${params.toString()}`
  }

  const cards = [
    { label: `Compradores (${days} dias)`, value: String(overview.buyers) },
    { label: 'Entraram na área', value: `${overview.loggedInPct}%` },
    { label: 'Abriram algum item', value: `${overview.openedPct}%` },
    { label: 'E-mails com falha no período', value: String(failedEmails) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={ui.h1}>Sucesso do cliente — {store.name}</h1>
        <nav className="ml-auto flex gap-2">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={href({ periodo: d })} className={ui.chip(d === days)}>{d} dias</Link>
          ))}
        </nav>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`${ui.card} p-4`}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-sm text-texto-suave">{c.label}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => (
          <Link key={s} href={href({ filtro: s })} className={ui.chip(s === status)}>
            {s === 'todos' ? 'Todos' : SUCCESS_STATUS_LABEL[s]}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/sucesso">
          <input type="hidden" name="periodo" value={days} />
          <input type="hidden" name="filtro" value={status} />
          <input name="q" defaultValue={query} placeholder="Buscar por e-mail" className={`${ui.input} py-1.5 text-sm`} />
          <button type="submit" className={ui.buttonGhost}>Buscar</button>
        </form>
      </div>

      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr>
              <th className={ui.th}>E-mail</th><th className={ui.th}>Primeira compra</th><th className={ui.th}>Pedidos pagos</th>
              <th className={ui.th}>Último acesso</th><th className={ui.th}>Itens abertos</th><th className={ui.th}>Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {visible.map((r) => (
              <tr key={r.customerId}>
                <td className={ui.td}><Link href={`/admin/clientes/${r.customerId}`} className="underline hover:text-destaque">{r.email}</Link></td>
                <td className={`${ui.td} whitespace-nowrap`}>{formatDateTime(r.firstPaidAt)}</td>
                <td className={ui.td}>{r.paidOrders}</td>
                <td className={`${ui.td} whitespace-nowrap`}>{r.lastSeenAt ? formatDateTime(r.lastSeenAt) : 'nunca'}</td>
                <td className={ui.td}>{r.itemOpens}</td>
                <td className={ui.td}><span className={`${ui.pill} ${SUCCESS_STATUS_STYLE[r.status]}`}>{SUCCESS_STATUS_LABEL[r.status]}</span></td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={6} className={`${ui.td} text-texto-suave`}>Nenhum cliente neste filtro.</td></tr>}
          </tbody>
        </table>
      </div>

      <nav className="flex gap-3">
        {page > 0 && <Link href={href({ pagina: page - 1 })} className={ui.buttonGhost}>← Anterior</Link>}
        {(page + 1) * PAGE_SIZE < filtered.length && <Link href={href({ pagina: page + 1 })} className={ui.buttonGhost}>Próxima →</Link>}
      </nav>
    </div>
  )
}
