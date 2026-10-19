import { createHash } from 'node:crypto'
import type { PaytPostback } from '@/lib/payt/parse'

export type InboxJob = { id: string; eventId: string; payload: unknown; leaseToken: string }
export interface InboxRepo {
  enqueue(key: string, transactionId: string, payload: unknown): Promise<string>
  claim(): Promise<InboxJob | null>
  complete(job: InboxJob): Promise<void>
  fail(job: InboxJob, error: string): Promise<void>
}

export function inboxKey(postback: PaytPostback): string {
  // O mesmo aviso com novos parâmetros de campanha continua sendo a mesma venda.
  // Bumps adicionais e mudanças de status continuam sendo processados.
  return createHash('sha256').update(JSON.stringify({
    transactionId: postback.transactionId, status: postback.status,
    products: postback.products.map((p) => p.code).sort(),
  })).digest('hex')
}

export async function drainInbox(repo: InboxRepo, process: (payload: unknown, eventId: string) => Promise<unknown>) {
  const started = Date.now()
  let completed = 0
  let failed = 0
  // A lease é maior que maxDuration da função; invocações encerradas podem ser retomadas.
  for (let i = 0; i < 10 && Date.now() - started < 35_000; i++) {
    const job = await repo.claim()
    if (!job) break
    try {
      await process(job.payload, job.eventId)
      await repo.complete(job)
      completed++
    } catch (error) {
      await repo.fail(job, error instanceof Error ? error.message : String(error))
      failed++
    }
  }
  return { completed, failed }
}
