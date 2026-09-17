const PERIODS = [7, 30, 90] as const

export function parsePeriod(value: unknown): number {
  const n = Number(value)
  return (PERIODS as readonly number[]).includes(n) ? n : 30
}

export function periodWindow(days: number, now: Date = new Date()): { now: Date; sinceIso: string } {
  return { now, sinceIso: new Date(now.getTime() - days * 86_400_000).toISOString() }
}
