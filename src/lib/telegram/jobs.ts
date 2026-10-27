import { timingSafeEqual } from 'node:crypto'
export function authorizeTelegramJob(request: Request): boolean {
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  return [process.env.CRON_SECRET, process.env.TELEGRAM_WEBHOOK_SECRET].filter(Boolean).some(secret => {
    const expected = Buffer.from(`Bearer ${secret}`)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  })
}
