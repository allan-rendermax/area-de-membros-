import { after } from 'next/server'
import { getAgentConfig } from '@/lib/agent/config'
import { processConversation } from '@/lib/agent/process'
import { createAgentRepository } from '@/lib/agent/repository'
import { handleZernioWebhook } from '@/lib/agent/webhook'
import { getStoreBySlug } from '@/lib/data/stores'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request): Promise<Response> {
  const config = getAgentConfig()
  if (!config) return Response.json({ error: 'agente desativado' }, { status: 503 })

  let store
  try { store = await getStoreBySlug(config.storeSlug) }
  catch { return Response.json({ error: 'loja indisponível' }, { status: 503 }) }
  if (!store) return Response.json({ error: 'loja indisponível' }, { status: 503 })

  try {
    return await handleZernioWebhook(request, {
      config, storeId: store.id, repo: createAgentRepository(), now: () => new Date(),
      schedule: (conversationId, messageId) => after(() => processConversation({ conversationId, messageId })),
    })
  } catch { return Response.json({ error: 'falha temporária' }, { status: 500 }) }
}
