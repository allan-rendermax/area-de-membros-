import { countEmailsUsedToday } from '@/lib/data/email-log'
import { getStoreBySlug } from '@/lib/data/stores'
import { env } from '@/lib/env'
import { createPlatformOperations } from '@/lib/telegram/platform'
import type { ActionResult, CustomerLookup, SupportAction } from '@/lib/telegram/types'
import { getAgentConfig, type AgentConfig } from './config'
import { createAgentActions, createAgentRepository, type AgentActions, type AgentRepository } from './repository'

type PurchaseDeps = {
  ops: {
    lookup(email: string): Promise<CustomerLookup>
    execute(action: Pick<SupportAction, 'kind' | 'customerId' | 'storeId' | 'expectedEmail' | 'newEmail'>): Promise<ActionResult>
  }
  repo: Pick<AgentRepository, 'agentResendsToday' | 'agentResendSince'>
  actions: AgentActions
  emailsUsedToday(): Promise<number>
  dailyEmailLimit: number
  storeId: string
  config: Pick<AgentConfig, 'dailyResendLimit' | 'quotaReserve'>
  now(): Date
}

type PurchaseResult = { found: boolean }
type ResendResult = { ok: true } | { ok: false; reason: 'nao_encontrado' | 'limite_dia' | 'limite_conversa' | 'cota' | 'recusado' | 'incerto' }

export function createPurchaseTools(deps: PurchaseDeps) {
  async function findPurchase(email: string): Promise<PurchaseResult> {
    const result = await deps.ops.lookup(email)
    return { found: result.customer !== null }
  }

  async function resendAccess(input: { email: string; conversationId: string }): Promise<ResendResult> {
    let actionId: string | null = null
    let logId: string | null = null
    try {
      const { customer } = await deps.ops.lookup(input.email)
      if (!customer) return { ok: false, reason: 'nao_encontrado' }
      const since = new Date(deps.now().getTime() - 24 * 60 * 60 * 1000)
      if (await deps.repo.agentResendSince(input.conversationId, since)) return { ok: false, reason: 'limite_conversa' }
      if (await deps.repo.agentResendsToday(deps.storeId) >= deps.config.dailyResendLimit) return { ok: false, reason: 'limite_dia' }
      if (deps.dailyEmailLimit - await deps.emailsUsedToday() < deps.config.quotaReserve) return { ok: false, reason: 'cota' }
      actionId = await deps.actions.create({
        customerId: customer.id, storeId: deps.storeId, expectedEmail: customer.email, conversationId: input.conversationId,
      })
      if (actionId === 'locked') return { ok: false, reason: 'incerto' }
      const result = await deps.ops.execute({
        kind: 'resend', customerId: customer.id, storeId: deps.storeId, expectedEmail: customer.email, newEmail: null,
      })
      logId = result.logId ?? null
      await deps.actions.finish(actionId, result.state, logId, result.text)
      if (result.state === 'uncertain') return { ok: false, reason: 'incerto' }
      return logId ? { ok: true } : { ok: false, reason: 'recusado' }
    } catch {
      if (actionId && actionId !== 'locked') {
        try {
          await deps.actions.finish(actionId, 'uncertain', logId, 'Não foi possível confirmar o reenvio. Confira o registro antes de repetir.')
        } catch {
          // Keep the processing/uncertain customer lock until reconciliation.
        }
      }
      return { ok: false, reason: 'incerto' }
    }
  }

  return { findPurchase, resendAccess }
}

export async function createAgentPurchase(storeSlug: string) {
  const config = getAgentConfig()
  if (!config) throw new Error('agent_config_missing')
  const store = await getStoreBySlug(storeSlug)
  if (!store) throw new Error('agent_store_missing')
  return createPurchaseTools({
    ops: await createPlatformOperations(storeSlug), repo: createAgentRepository(), actions: createAgentActions(),
    emailsUsedToday: countEmailsUsedToday, dailyEmailLimit: env.emailDailyLimit, storeId: store.id, config,
    now: () => new Date(),
  })
}
