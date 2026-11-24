import { createTelegramClient } from '@/lib/telegram/client'
import { getTelegramConfig } from '@/lib/telegram/config'
import { handleTelegramUpdate, telegramUpdateSchema } from '@/lib/telegram/handler'
import { createPlatformOperations } from '@/lib/telegram/platform'
import { createSupportRepository } from '@/lib/telegram/repository'
import { postTelegramWebhook } from '@/lib/telegram/webhook'
import { listFailures } from '@/lib/telegram/monitoring-server'
import { isSupportUser, teamOwners } from '@/lib/telegram/team-access'
import { handleTeamUpdate } from '@/lib/telegram/team'
import { createTeamRepository } from '@/lib/telegram/team-repository'
import { getAgentConfig } from '@/lib/agent/config'
import { createAgentRepository } from '@/lib/agent/repository'
import { createZernioClient } from '@/lib/agent/zernio'
import { createLearn } from '@/lib/agent/learn'
import { handleAgentTelegram } from '@/lib/agent/telegram'
import { getStoreBySlug } from '@/lib/data/stores'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const config = getTelegramConfig()
  return postTelegramWebhook(request, config, async input => {
    const io = createTelegramClient(config!.token)
    const repo = createSupportRepository()
    if (await handleTeamUpdate(input, { owners: teamOwners(), io, repo: createTeamRepository(), acceptUpdate: id => repo.acceptUpdate(id) })) return
    const update = telegramUpdateSchema.parse(input)
    const userId = (update.callback_query?.from ?? update.message?.from)!.id
    const owners = teamOwners()
    if (owners.includes(userId)) {
      const agentConfig = getAgentConfig()
      if (agentConfig) {
        const store = await getStoreBySlug(agentConfig.storeSlug)
        if (!store) throw new Error('agent_store_unavailable')
        if (await handleAgentTelegram(update, {
          owners, repo: createAgentRepository(), zernio: createZernioClient(agentConfig.zernioApiKey),
          io, learn: createLearn(agentConfig.anthropicApiKey, agentConfig.model), storeId: store.id, now: () => new Date(),
        })) return
      }
    }
    // Recheck before starting support work, including confirmations from an older message.
    if (!(await isSupportUser(userId, config!))) return
    const ops = await createPlatformOperations(config!.storeSlug)
    await handleTelegramUpdate(input, { io, ops, repo, allowedUsers: [userId], owners, now: () => new Date(), failures: offset => listFailures(config!.storeSlug, offset) })
  }, async userId => {
    await createTelegramClient(config!.token).send(userId, `🆔 Seu ID do Telegram: <code>${userId}</code>\nEnvie esse número ao responsável da empresa para solicitar liberação. Seu acesso aos clientes ainda não está autorizado.`)
  }, userId => isSupportUser(userId, config!))
}
