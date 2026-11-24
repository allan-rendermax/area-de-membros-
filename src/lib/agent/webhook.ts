import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type { AgentConfig } from './config'
import type { AgentRepository } from './repository'

const maxBodyBytes = 64 * 1024
const eventSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  message: z.object({
    id: z.string().min(1),
    conversationId: z.string().min(1),
    platform: z.string(),
    direction: z.enum(['incoming', 'outgoing']),
    text: z.string().nullish().transform(text => text ?? ''),
    sentVia: z.string().nullish(),
    automationId: z.string().nullish(),
    workflowId: z.string().nullish(),
    broadcastId: z.string().nullish(),
    sequenceId: z.string().nullish(),
    sender: z.object({ id: z.string().min(1), name: z.string().nullish(), username: z.string().nullish() }).optional(),
  }),
  conversation: z.object({ id: z.string().min(1) }),
  account: z.object({ id: z.string().min(1) }),
})

export async function handleZernioWebhook(request: Request, deps: {
  config: AgentConfig | null
  storeId: string
  repo: AgentRepository
  schedule(conversationId: string, messageId: string): void
  after(callback: () => Promise<void>): void
  sleep(ms: number): Promise<void>
  now(): Date
}): Promise<Response> {
  const { config, storeId, repo } = deps
  if (!config) return Response.json({ error: 'agente desativado' }, { status: 503 })
  const supplied = request.headers.get('X-Zernio-Signature') ?? ''
  if (!/^[a-f0-9]{64}$/.test(supplied)) return Response.json({ error: 'não autorizado' }, { status: 401 })
  if (Number(request.headers.get('content-length') || 0) > maxBodyBytes) return Response.json({ error: 'corpo muito grande' }, { status: 413 })

  let raw: ArrayBuffer
  try { raw = await request.arrayBuffer() }
  catch { return Response.json({ error: 'corpo inválido' }, { status: 400 }) }
  if (raw.byteLength > maxBodyBytes) return Response.json({ error: 'corpo muito grande' }, { status: 413 })
  const expected = createHmac('sha256', config.webhookSecret).update(Buffer.from(raw)).digest()
  if (!timingSafeEqual(Buffer.from(supplied, 'hex'), expected)) return Response.json({ error: 'não autorizado' }, { status: 401 })

  let input: unknown
  try { input = JSON.parse(new TextDecoder().decode(raw)) }
  catch { return Response.json({ error: 'corpo inválido' }, { status: 400 }) }
  const parsed = eventSchema.safeParse(input)
  if (!parsed.success) {
    console.error('agent_webhook_invalid_payload')
    return Response.json({ ok: true })
  }
  const { event, message, account } = parsed.data
  const { platform } = message
  if (!config.accountIds.includes(account.id) || (platform !== 'instagram' && platform !== 'facebook')) return Response.json({ ok: true })

  try {
    if (event === 'message.received' && message.direction === 'incoming') {
      const fresh = await repo.recordIncoming({
        id: message.id, conversationId: message.conversationId, storeId, accountId: account.id,
        platform, customerName: message.sender?.name || message.sender?.username || '', text: message.text.trim() ? message.text : '[anexo sem texto]', at: deps.now(),
      })
      if (fresh) deps.schedule(message.conversationId, message.id)
    } else if (event === 'message.sent') {
      if ([message.automationId, message.workflowId, message.broadcastId, message.sequenceId].some(id => id?.trim())) return Response.json({ ok: true })
      deps.after(async () => {
        try {
          await deps.sleep(10000)
          if (await repo.isOwnOutgoing(message.id, {
            conversationId: message.conversationId, text: message.text,
            since: new Date(deps.now().getTime() - 120000),
          })) return
          const conversation = await repo.getConversation(message.conversationId)
          if (!conversation || conversation.storeId !== storeId) return
          await repo.pauseConversation(message.conversationId, new Date(deps.now().getTime() + 24 * 60 * 60 * 1000))
          await repo.recordOutgoing({ id: message.id, conversationId: message.conversationId, author: 'allan', text: message.text })
        } catch { console.error('agent_webhook_failed') }
      })
    }
  } catch { return Response.json({ error: 'falha temporária' }, { status: 500 }) }
  return Response.json({ ok: true })
}
