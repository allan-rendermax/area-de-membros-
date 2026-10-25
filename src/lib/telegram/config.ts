export type TelegramConfig = { token: string; secret: string; allowedUsers: number[]; storeSlug: string }
export function getTelegramConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? ''
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? ''
  const userValues = (process.env.TELEGRAM_ADMIN_USER_IDS ?? '').split(',').map(s => s.trim())
  const storeSlug = process.env.TELEGRAM_SUPPORT_STORE_SLUG?.trim() || process.env.DEFAULT_STORE_SLUG?.trim() || ''
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token) || !/^[A-Za-z0-9_-]{32,256}$/.test(secret) || !storeSlug) return null
  if (!userValues.length || userValues.some(s => !/^\d+$/.test(s) || !Number.isSafeInteger(Number(s)) || Number(s) <= 0)) return null
  return { token, secret, allowedUsers: [...new Set(userValues.map(Number))], storeSlug }
}
