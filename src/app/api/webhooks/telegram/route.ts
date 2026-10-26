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
    // Recheck before starting support work, including confirmations from an older message.
    if (!(await isSupportUser(userId, config!))) return
    const ops = await createPlatformOperations(config!.storeSlug)
    await handleTelegramUpdate(input, { io, ops, repo, allowedUsers: [userId], now: () => new Date(), failures: offset => listFailures(config!.storeSlug, offset) })
  }, async userId => {
    await createTelegramClient(config!.token).send(userId, `Seu ID do Telegram: ${userId}\nEnvie esse número ao responsável da empresa para solicitar liberação. Seu acesso aos clientes ainda não está autorizado.`)
  }, userId => isSupportUser(userId, config!))
}
