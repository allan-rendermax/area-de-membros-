export type AgentConfig = {
  zernioApiKey: string
  webhookSecret: string
  anthropicApiKey: string
  model: string
  accountIds: string[]
  storeSlug: string
  batchSeconds: number
  dailyResendLimit: 20
  quotaReserve: 30
}

export function getAgentConfig(): AgentConfig | null {
  const zernioApiKey = process.env.ZERNIO_API_KEY?.trim() ?? ''
  const webhookSecret = process.env.ZERNIO_WEBHOOK_SECRET?.trim() ?? ''
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? ''
  const accountIds = [...new Set((process.env.AGENT_ACCOUNT_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean))]
  if (!zernioApiKey || webhookSecret.length < 32 || !anthropicApiKey || !accountIds.length) return null

  const model = process.env.AGENT_MODEL?.trim() || 'claude-sonnet-5-5'
  const storeSlug = process.env.AGENT_STORE_SLUG?.trim() || 'arquitetura'
  const batchValue = Number(process.env.AGENT_BATCH_SECONDS?.trim() || '8')
  const batchSeconds = Number.isInteger(batchValue) && batchValue >= 0 && batchValue <= 60 ? batchValue : 8
  return { zernioApiKey, webhookSecret, anthropicApiKey, model, accountIds, storeSlug, batchSeconds, dailyResendLimit: 20, quotaReserve: 30 }
}
