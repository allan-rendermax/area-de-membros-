import { setTimeout as sleep } from 'node:timers/promises'
import { createCallModel, runAgent, type AgentTools, type CallModel } from './brain'
import type { AgentConfig } from './config'
import { createRealEscalate, type Escalate } from './escalation'
import { buildSystemPrompt } from './prompt'
import { createAgentRepository, type AgentRepository } from './repository'
import { createRealAgentTools } from './tools'
import type { AgentConversation } from './types'
import { createZernioClient, type ZernioClient } from './zernio'

type ProcessInput = { conversationId: string; messageId: string }
type ProcessResult = 'respondido' | 'escalado' | 'ignorado'
export type ProcessDependencies = {
  repo: AgentRepository
  zernio: ZernioClient
  brain: typeof runAgent
  callModel: CallModel
  buildTools(conversation: AgentConversation): AgentTools | Promise<AgentTools>
  escalate: Escalate
  sleep(ms: number): Promise<void>
  now(): Date
  config: AgentConfig
  storeId: string
}

export async function processConversation(input: ProcessInput, deps: ProcessDependencies): Promise<ProcessResult> {
  await deps.sleep(deps.config.batchSeconds * 1000)
  const { repo } = deps
  const stored = await repo.getConversation(input.conversationId)
  if (!stored || stored.storeId !== deps.storeId) return 'ignorado'

  const beforeClaim = await repo.recentMessages(stored.id, 12)
  if (beforeClaim.findLast(message => message.author === 'cliente')?.id !== input.messageId) return 'ignorado'

  let claimTime = deps.now()
  const deadline = claimTime.getTime() + 200000
  while (!await repo.claimProcessing(stored.id, new Date(claimTime.getTime() + 290000), claimTime)) {
    const remaining = deadline - deps.now().getTime()
    if (remaining <= 0) return 'ignorado'
    await deps.sleep(Math.min(3000, remaining))
    const latest = await repo.recentMessages(stored.id, 12)
    if (latest.findLast(message => message.author === 'cliente')?.id !== input.messageId) return 'ignorado'
    claimTime = deps.now()
    if (claimTime.getTime() >= deadline) return 'ignorado'
  }

  try {
    const current = await repo.getConversation(stored.id)
    if (!current || current.storeId !== deps.storeId) return 'ignorado'
    let conversation = current
    const recent = await repo.recentMessages(conversation.id, 12)
    const incoming = recent.findLast(message => message.author === 'cliente')
    if (!incoming || incoming.id !== input.messageId) return 'ignorado'

    const escalate = async (reason: string) => deps.escalate({
      conversation, reason, summary: incoming.text, recent,
    })

    if (!await repo.isEnabled(deps.storeId)) {
      await escalate('agente_pausado')
      return 'escalado'
    }

    const now = deps.now()
    if (conversation.state === 'paused') {
      if (!conversation.pausedUntil || conversation.pausedUntil > now) return 'ignorado'
      await repo.setState(conversation.id, 'active')
      conversation = { ...conversation, state: 'active', pausedUntil: null }
    }
    if (conversation.state === 'escalated') {
      await escalate('continuacao')
      return 'escalado'
    }
    if (!conversation.lastIncomingAt || now.getTime() - conversation.lastIncomingAt.getTime() > 24 * 60 * 60 * 1000) {
      await escalate('fora_da_janela')
      return 'escalado'
    }
    if (recent.at(-1)?.author === 'agente') return 'ignorado'

    try {
      const system = buildSystemPrompt({
        knowledge: await repo.knowledge(deps.storeId), platform: conversation.platform,
        today: new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
        }).format(now),
      })
      const result = await deps.brain({
        system,
        messages: recent.map(message => ({ role: message.author === 'cliente' ? 'user' : 'assistant', text: message.text })),
        tools: await deps.buildTools(conversation), callModel: deps.callModel,
      })
      if (result.escalated) return 'escalado'
      return result.replied ? 'respondido' : 'ignorado'
    } catch {
      try {
        await escalate('erro_interno')
        return 'escalado'
      } catch {
        console.error('agent_process_failed')
        return 'ignorado'
      }
    }
  } finally {
    await repo.releaseProcessing(stored.id)
  }
}

export async function processConversationReal(
  input: ProcessInput,
  context: { config: AgentConfig; storeId: string },
): Promise<ProcessResult> {
  try {
    return await processConversation(input, {
      ...context, repo: createAgentRepository(), zernio: createZernioClient(context.config.zernioApiKey),
      brain: runAgent, callModel: createCallModel(context.config.anthropicApiKey, context.config.model),
      buildTools: createRealAgentTools,
      // Resolve Telegram only if an escalation is actually needed.
      escalate: escalation => createRealEscalate()(escalation),
      sleep, now: () => new Date(),
    })
  } catch {
    // Storage/configuration failures in after() must not expose customer data.
    console.error('agent_process_failed')
    return 'ignorado'
  }
}
