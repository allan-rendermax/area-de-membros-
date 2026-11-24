import type { AgentTools } from './brain'
import { getAgentConfig } from './config'
import { createRealEscalate, type Escalate } from './escalation'
import { createAgentPurchase } from './purchase'
import { createAgentRepository, type AgentRepository } from './repository'
import type { AgentConversation } from './types'
import { createZernioClient, type ZernioClient } from './zernio'

export function createAgentTools(ctx: {
  conversation: AgentConversation
  zernio: ZernioClient
  repo: AgentRepository
  purchase: Awaited<ReturnType<typeof createAgentPurchase>>
  escalate: Escalate
}): AgentTools {
  const { conversation, zernio, repo, purchase, escalate } = ctx
  let escalationNotified = conversation.state === 'escalated'
  let replied = false

  async function responder(texto: string) {
    const { messageId } = await zernio.send({ conversationId: conversation.id, accountId: conversation.accountId, text: texto })
    replied = true
    await repo.recordOutgoing({ id: messageId, conversationId: conversation.id, author: 'agente', text: texto })
    return { ok: true }
  }

  return {
    async buscar_compra(email) {
      const result = await purchase.findPurchase(email)
      if (result.found) return { found: true }
      const misses = await repo.incrementLookupMiss(conversation.id)
      return misses >= 2 ? { found: false, instrucao: 'escalar' } : { found: false }
    },
    async reenviar_acesso(email) {
      return purchase.resendAccess({ email, conversationId: conversation.id })
    },
    responder,
    async escalar(motivo, resumo) {
      const current = await repo.getConversation(conversation.id) ?? conversation
      if (!replied && !escalationNotified && current.state !== 'escalated') {
        const knowledge = await repo.knowledge(conversation.storeId)
        const notice = knowledge.find(entry => entry.topic === 'escalacao')?.rule ?? 'Vou verificar com a equipe e te respondo aqui 💛'
        await responder(notice)
        escalationNotified = true
      }
      await escalate({ conversation: current, reason: motivo, summary: resumo, recent: await repo.recentMessages(conversation.id, 6) })
      return { ok: true }
    },
  }
}

export async function createRealAgentTools(conversation: AgentConversation): Promise<AgentTools> {
  const config = getAgentConfig()
  if (!config) throw new Error('agent_config_missing')
  return createAgentTools({
    conversation,
    zernio: createZernioClient(config.zernioApiKey),
    repo: createAgentRepository(),
    purchase: await createAgentPurchase(config.storeSlug),
    escalate: createRealEscalate(),
  })
}
