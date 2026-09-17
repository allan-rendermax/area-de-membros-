import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { EMAIL_KIND_LABEL, EMAIL_STATUS_STYLE, formatDateTime } from '@/lib/admin/labels'
import { requireAdmin } from '@/lib/auth/require-admin'
import { countEmailsUsedToday, countUnresolvedFailed, listEmailLog, listUnresolvedFailed, type EmailLogFilter } from '@/lib/data/email-log'
import { groupFailedEmails, MAX_RESEND_PER_RUN } from '@/lib/email/batch'
import { env } from '@/lib/env'
import { reenviarEmail, reenviarEmLote } from './actions'

const FILTERS: { value: EmailLogFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'falhou', label: 'Falharam' },
  { value: 'enviado', label: 'Enviados' },
  { value: 'pendente', label: 'Pendentes' },
]

export const dynamic = 'force-dynamic'

export default async function EmailsPage({ searchParams }: PageProps<'/admin/emails'>) {
  await requireAdmin()
  const { filtro, pagina, msg } = await searchParams
  const filter = FILTERS.find((f) => f.value === filtro)?.value ?? 'todos'
  const page = Math.max(0, Number(pagina) || 0)
  const [{ entries, hasMore }, usedToday, failedCount] = await Promise.all([
    listEmailLog(filter, page),
    countEmailsUsedToday(),
    countUnresolvedFailed(),
  ])
  const limit = env.emailDailyLimit
  const slotsLeft = Math.max(0, limit - usedToday)
  const groups = groupFailedEmails(await listUnresolvedFailed()).length
  const nextBatch = Math.min(groups, slotsLeft, MAX_RESEND_PER_RUN)
  const pageHref = (n: number) => `/admin/emails?filtro=${filter}&pagina=${n}`

  return (
    <div className="flex flex-col gap-4">
      <h1 className={ui.h1}>E-mails</h1>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}

      <section className={`${ui.card} flex flex-wrap items-center gap-6 p-4`}>
        <div>
          <p className="text-2xl font-bold">{failedCount}</p>
          <p className="text-sm text-texto-suave">com falha aguardando reenvio</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{usedToday} / {limit}</p>
          <p className="text-sm text-texto-suave">usados hoje (limite do plano)</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{nextBatch}</p>
          <p className="text-sm text-texto-suave">serão reenviados no próximo clique (1 por cliente e loja; cabem {slotsLeft} hoje)</p>
        </div>
        <form action={reenviarEmLote} className="ml-auto">
          <button type="submit" className={ui.button} disabled={nextBatch === 0}>Reenviar em lote</button>
        </form>
      </section>
      <p className="text-sm text-texto-suave">
        O reenvio manda um e-mail por cliente com a lista atual de produtos liberados. Use depois que o domínio de envio estiver verificado.
      </p>

      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/admin/emails?filtro=${f.value}`} className={ui.chip(f.value === filter)}>{f.label}</Link>
        ))}
      </nav>

      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr>
              <th className={ui.th}>Data</th><th className={ui.th}>Loja</th><th className={ui.th}>E-mail</th>
              <th className={ui.th}>Tipo</th><th className={ui.th}>Status</th><th className={ui.th}>Erro</th><th className={ui.th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className={`${ui.td} whitespace-nowrap`}>{formatDateTime(e.createdAt)}</td>
                <td className={ui.td}>{e.storeName ?? '—'}</td>
                <td className={ui.td}>
                  {e.customerId ? <Link href={`/admin/clientes/${e.customerId}`} className="underline">{e.toEmail}</Link> : e.toEmail}
                </td>
                <td className={ui.td}>{EMAIL_KIND_LABEL[e.kind] ?? e.kind}</td>
                <td className={ui.td}>
                  <span className={`${ui.pill} ${EMAIL_STATUS_STYLE[e.status]}`}>{e.status}</span>
                  {e.resolved && <span className="ml-2 text-xs text-texto-suave">reenviado</span>}
                </td>
                <td className={`${ui.td} max-w-xs truncate text-texto-suave`} title={e.error ?? undefined}>{e.error ?? ''}</td>
                <td className={ui.td}>
                  {e.status === 'falhou' && !e.resolved && (
                    <form action={reenviarEmail}>
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" className={ui.buttonGhost}>Reenviar</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={7} className={`${ui.td} text-texto-suave`}>Nenhum e-mail.</td></tr>}
          </tbody>
        </table>
      </div>

      <nav className="flex gap-3">
        {page > 0 && <Link href={pageHref(page - 1)} className={ui.buttonGhost}>← Anteriores</Link>}
        {hasMore && <Link href={pageHref(page + 1)} className={ui.buttonGhost}>Mais antigos →</Link>}
      </nav>
    </div>
  )
}
