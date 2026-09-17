import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { formatDateTime, outcomeLabel, outcomeStyle } from '@/lib/admin/labels'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { getPaytEvent } from '@/lib/data/payt-events'
import { maskPayload } from '@/lib/payt/mask'

export default async function AvisoPage({ params }: PageProps<'/admin/avisos/[id]'>) {
  await requireAdmin()
  const { id } = await params
  const event = isUuid(id) ? await getPaytEvent(id) : null
  if (!event) notFound()

  const details: [string, string][] = [
    ['Recebido', formatDateTime(event.receivedAt)],
    ['Processado', event.processedAt ? formatDateTime(event.processedAt) : '—'],
    ['E-mail', event.customerEmail ?? '—'],
    ['Códigos', event.productCodes.join(', ') || '—'],
    ['Status Payt', event.paytStatus ?? '—'],
    ['Chave válida', event.keyValid === null ? '—' : event.keyValid ? 'Sim' : 'Não'],
    ['Erro', event.error ?? '—'],
  ]

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/avisos" className="text-sm text-texto-suave hover:text-texto">← Avisos</Link>
      <div className="flex items-center gap-3">
        <h1 className={ui.h1}>Aviso da Payt</h1>
        <span className={`${ui.pill} ${outcomeStyle(event.outcome)}`}>{outcomeLabel(event.outcome)}</span>
      </div>
      <dl className={`${ui.card} grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-[160px_1fr]`}>
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-texto-suave">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h2 className="mb-2 font-semibold">Conteúdo recebido (chave escondida)</h2>
        <pre className={`${ui.card} overflow-x-auto p-4 text-xs leading-relaxed`}>{JSON.stringify(maskPayload(event.payload), null, 2)}</pre>
      </section>
    </div>
  )
}
