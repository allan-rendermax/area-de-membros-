import Link from 'next/link'
import { ui } from '@/components/admin/ui'
import { formatDateTime, outcomeLabel, outcomeStyle } from '@/lib/admin/labels'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listKnownProductCodes, listPaytEvents, type PaytEventFilter } from '@/lib/data/payt-events'

const FILTERS: { value: PaytEventFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'erros', label: 'Com erro' },
  { value: 'desconhecidos', label: 'Código desconhecido' },
]

export const dynamic = 'force-dynamic'

export default async function AvisosPage({ searchParams }: PageProps<'/admin/avisos'>) {
  await requireAdmin()
  const { filtro, pagina } = await searchParams
  const filter = FILTERS.find((f) => f.value === filtro)?.value ?? 'todos'
  const page = Math.max(0, Number(pagina) || 0)
  const { rows, hasMore } = await listPaytEvents(filter, page)
  const known = await listKnownProductCodes([...new Set(rows.flatMap((r) => r.productCodes))])
  const pageHref = (n: number) => `/admin/avisos?filtro=${filter}&pagina=${n}`

  return (
    <div className="flex flex-col gap-4">
      <h1 className={ui.h1}>Avisos da Payt</h1>
      <p className="text-sm text-texto-suave">Todos os avisos recebidos, de todas as lojas. Códigos sem oferta aparecem destacados.</p>
      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/admin/avisos?filtro=${f.value}`} className={ui.chip(f.value === filter)}>{f.label}</Link>
        ))}
      </nav>
      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead className="border-b border-borda">
            <tr>
              <th className={ui.th}>Recebido</th><th className={ui.th}>E-mail</th><th className={ui.th}>Códigos</th>
              <th className={ui.th}>Status Payt</th><th className={ui.th}>Chave válida</th><th className={ui.th}>Resultado</th><th className={ui.th}>Erro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`${ui.td} whitespace-nowrap`}>
                  <Link href={`/admin/avisos/${r.id}`} className="underline hover:text-destaque">{formatDateTime(r.receivedAt)}</Link>
                </td>
                <td className={ui.td}>{r.customerEmail ?? '—'}</td>
                <td className={ui.td}>
                  <ul className="flex flex-col gap-1">
                    {r.productCodes.map((code) => (
                      <li key={code}>
                        {known.has(code) ? (
                          code
                        ) : (
                          <>
                            <span className="text-alerta">{code}</span>{' '}
                            <Link href={`/admin/ofertas/novo?codigo=${encodeURIComponent(code)}`} className="text-destaque hover:underline">criar oferta</Link>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className={ui.td}>{r.paytStatus ?? '—'}</td>
                <td className={ui.td}>{r.keyValid === true ? 'Sim' : r.keyValid === false ? 'Não' : '—'}</td>
                <td className={ui.td}><span className={`${ui.pill} ${outcomeStyle(r.outcome)}`}>{outcomeLabel(r.outcome)}</span></td>
                <td className={`${ui.td} max-w-xs truncate text-texto-suave`} title={r.error ?? undefined}>{r.error ?? ''}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className={`${ui.td} text-texto-suave`}>Nenhum aviso.</td></tr>}
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
