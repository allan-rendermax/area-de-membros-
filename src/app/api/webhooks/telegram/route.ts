import { createTelegramClient } from '@/lib/telegram/client'
import { getTelegramConfig } from '@/lib/telegram/config'
import { handleTelegramUpdate } from '@/lib/telegram/handler'
import { createPlatformOperations } from '@/lib/telegram/platform'
import { createSupportRepository } from '@/lib/telegram/repository'
import { postTelegramWebhook } from '@/lib/telegram/webhook'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const config = getTelegramConfig()
  return postTelegramWebhook(request, config, async input => {
    const io = createTelegramClient(config!.token)
    const ops = await createPlatformOperations(config!.storeSlug)
    await handleTelegramUpdate(input, { io, ops, repo: createSupportRepository(), allowedUsers: config!.allowedUsers, now: () => new Date() })
  })
}
