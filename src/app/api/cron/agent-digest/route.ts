import { getAgentConfig } from '@/lib/agent/config'
import { buildDigest } from '@/lib/agent/digest'
import { createAgentRepository } from '@/lib/agent/repository'
import { getStoreBySlug } from '@/lib/data/stores'
import { createTelegramClient } from '@/lib/telegram/client'
import { getTelegramConfig } from '@/lib/telegram/config'
import { authorizeTelegramJob } from '@/lib/telegram/jobs'
import { teamOwners } from '@/lib/telegram/team-access'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!authorizeTelegramJob(request)) return Response.json({ error: 'não autorizado' }, { status: 401 })
  const config = getAgentConfig(), telegram = getTelegramConfig()
  if (!config || !telegram) return Response.json({ error: 'agente ou Telegram indisponível' }, { status: 503 })
  try {
    const owners = teamOwners()
    if (!owners.length) return Response.json({ error: 'proprietários não configurados' }, { status: 503 })
    const store = await getStoreBySlug(config.storeSlug)
    if (!store) return Response.json({ error: 'loja indisponível' }, { status: 503 })
    const since = new Date(Date.now() - 7 * 86400_000)
    const digest = buildDigest(await createAgentRepository().weeklyDigest(store.id, since))
    const io = createTelegramClient(telegram.token)
    let sent = 0
    for (const owner of owners) {
      await io.send(owner, digest.text, digest.buttons)
      sent++
    }
    return Response.json({ sent })
  } catch { return Response.json({ error: 'falha no resumo semanal' }, { status: 500 }) }
}
