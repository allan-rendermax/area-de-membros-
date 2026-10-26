import { authorizeTelegramJob } from '@/lib/telegram/jobs'
import { syncDelivery } from '@/lib/telegram/monitoring-server'
export const maxDuration = 300
export async function GET(request: Request) {
  if (!authorizeTelegramJob(request)) return Response.json({ error: 'não autorizado' }, { status: 401 })
  try { return Response.json(await syncDelivery()) }
  catch { return Response.json({ error: 'falha na conferência de e-mails' }, { status: 500 }) }
}
