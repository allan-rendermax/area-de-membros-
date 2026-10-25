import { timingSafeEqual } from 'node:crypto'
import type { TelegramConfig } from './config'
import { telegramUpdateSchema } from './handler'

export async function postTelegramWebhook(request: Request, config: TelegramConfig | null, process: (input: unknown) => Promise<void>): Promise<Response> {
  if (!config) return Response.json({ error: 'bot desativado' }, { status: 503 })
  const supplied = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
  const a = Buffer.from(supplied), b = Buffer.from(config.secret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: 'não autorizado' }, { status: 401 })
  if (Number(request.headers.get('content-length') || 0) > 32768) return Response.json({ error: 'corpo muito grande' }, { status: 413 })
  let input: unknown
  try {
    const body = await request.arrayBuffer()
    if (body.byteLength > 32768) return Response.json({ error: 'corpo muito grande' }, { status: 413 })
    input = JSON.parse(new TextDecoder().decode(body))
  } catch { return Response.json({ error: 'corpo inválido' }, { status: 400 }) }
  const parsed = telegramUpdateSchema.safeParse(input)
  if (!parsed.success) return Response.json({ ok: true })
  const { message, callback_query: cb } = parsed.data
  const msg = cb?.message ?? message, user = cb?.from ?? msg?.from
  // Check before constructing dependencies: strangers never trigger customer queries.
  if (!msg || !user || msg.chat.type !== 'private' || msg.chat.id !== user.id || !config.allowedUsers.includes(user.id)) return Response.json({ ok: true })
  try { await process(parsed.data); return Response.json({ ok: true }) }
  catch { return Response.json({ error: 'falha temporária' }, { status: 500 }) }
}
