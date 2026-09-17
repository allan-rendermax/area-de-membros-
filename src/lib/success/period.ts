const PERIODS = [7, 30, 90] as const

export function parsePage(value: unknown, totalItems: number, pageSize: number): number {
  const page = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : 0
  const lastPage = Math.max(0, Math.ceil(totalItems / pageSize) - 1)
  return Math.max(0, Math.min(page, lastPage))
}

export function parsePeriod(value: unknown): number {
  const n = Number(value)
  return (PERIODS as readonly number[]).includes(n) ? n : 30
}

export function periodWindow(days: number, now: Date = new Date()): { now: Date; sinceIso: string } {
  return { now, sinceIso: new Date(now.getTime() - days * 86_400_000).toISOString() }
}
