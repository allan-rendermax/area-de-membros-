export type SuccessStatus = 'nunca_entrou' | 'nao_abriu' | 'ativo' | 'inativo'

export type SuccessRow = {
  customerId: string
  email: string
  firstPaidAt: string
  paidOrders: number
  lastSeenAt: string | null
  itemOpens: number
  lastItemOpenAt: string | null
}

const DAY_MS = 86_400_000

export function classifyCustomer(row: SuccessRow, now: Date): SuccessStatus {
  const t = now.getTime()
  if (!row.lastSeenAt) return t - Date.parse(row.firstPaidAt) > DAY_MS ? 'nunca_entrou' : 'inativo'
  if (row.itemOpens === 0) return 'nao_abriu'
  if (row.lastItemOpenAt && t - Date.parse(row.lastItemOpenAt) <= 30 * DAY_MS) return 'ativo'
  return 'inativo'
}

export type SuccessOverview = { buyers: number; loggedInPct: number; openedPct: number }

export function summarizeSuccess(rows: SuccessRow[], now: Date, periodDays: number): SuccessOverview {
  const since = now.getTime() - periodDays * DAY_MS
  const inPeriod = rows.filter((r) => Date.parse(r.firstPaidAt) >= since)
  const pct = (n: number) => (inPeriod.length ? Math.round((n / inPeriod.length) * 100) : 0)
  return {
    buyers: inPeriod.length,
    loggedInPct: pct(inPeriod.filter((r) => r.lastSeenAt).length),
    openedPct: pct(inPeriod.filter((r) => r.itemOpens > 0).length),
  }
}
