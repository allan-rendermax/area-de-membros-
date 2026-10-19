import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { runPaytInbox } from '@/lib/orders/payt-inbox-server'

export const maxDuration = 60
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret ?? ''}`)
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  return NextResponse.json(await runPaytInbox())
}
