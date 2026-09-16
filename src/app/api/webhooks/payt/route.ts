import { NextResponse } from 'next/server'
import { createPostbackRepo } from '@/lib/data/postback-repo'
import { createResendMailer } from '@/lib/email/resend-mailer'
import { env } from '@/lib/env'
import { processPostback } from '@/lib/orders/process-postback'

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
    const result = await processPostback(body, {
      repo: createPostbackRepo(),
      mailer: createResendMailer(),
      integrationKey: env.paytIntegrationKey,
      storeSlug: env.defaultStoreSlug,
    })
    if (result.kind === 'unauthorized') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
    if (result.kind === 'invalid') return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true, result: result.kind })
  } catch {
    return NextResponse.json({ error: 'erro interno' }, { status: 500 })
  }
}
