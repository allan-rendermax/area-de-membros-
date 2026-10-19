import { after, NextResponse } from 'next/server'
import { createPostbackRepo } from '@/lib/data/postback-repo'
import { notifyAccess } from '@/lib/email/server'
import { env } from '@/lib/env'
import { keyMatches, processPostback } from '@/lib/orders/process-postback'
import { parsePaytPostback } from '@/lib/payt/parse'
import { enqueuePostback, runPaytInbox } from '@/lib/orders/payt-inbox-server'

export const maxDuration = 60

export async function POST(request: Request) {
  let body: unknown
  try {
    const contentType = request.headers.get('content-type') ?? ''
    body = contentType.includes('application/json')
      ? await request.json()
      : Object.fromEntries(new URLSearchParams(await request.text()))
  } catch {
    return NextResponse.json({ error: 'corpo inválido' }, { status: 400 })
  }

  try {
    const parsed = parsePaytPostback(body)
    if (keyMatches(body, env.paytIntegrationKey) && parsed.ok && !parsed.value.isTest) {
      await enqueuePostback(body, parsed.value)
      after(async () => {
        try { await runPaytInbox() }
        catch { console.error('payt_inbox_worker_failed') }
      })
      return NextResponse.json({ ok: true, result: 'recebido' })
    }
    const result = await processPostback(body, {
      repo: createPostbackRepo(),
      notify: notifyAccess,
      integrationKey: env.paytIntegrationKey,
    })
    if (result.kind === 'unauthorized') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
    if (result.kind === 'invalid') return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true, result: result.kind === 'processed' ? result.outcome : result.kind })
  } catch {
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}
