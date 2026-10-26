import { authorizeTelegramJob } from '@/lib/telegram/jobs'
import { runDailyReport, syncDelivery } from '@/lib/telegram/monitoring-server'
export const maxDuration = 300
export async function GET(request: Request) {
  if (!authorizeTelegramJob(request)) return Response.json({ error: 'não autorizado' }, { status: 401 })
  const now = new Date()
  // A stale provider must not suppress the operational report. It includes the last successful sync time.
  try { await syncDelivery() } catch { /* report explicitly shows cache age */ }
  try { return Response.json(await runDailyReport(now)) }
  catch { return Response.json({ error: 'falha no relatório' }, { status: 500 }) }
}
