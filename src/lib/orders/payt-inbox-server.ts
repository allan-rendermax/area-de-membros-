import { createPaytInboxRepo } from '@/lib/data/payt-inbox'
import { createPostbackRepo } from '@/lib/data/postback-repo'
import { notifyAccess } from '@/lib/email/server'
import type { PaytPostback } from '@/lib/payt/parse'
import { drainInbox, inboxKey } from './payt-inbox'
import { processPostback } from './process-postback'

export function enqueuePostback(body: unknown, parsed: PaytPostback) {
  return createPaytInboxRepo().enqueue(inboxKey(parsed), parsed.transactionId, body)
}

export function runPaytInbox() {
  return drainInbox(createPaytInboxRepo(), async (payload, eventId) => {
    // Only authenticated receipts enter this service-role-only inbox. A later
    // key rotation must not invalidate work that was already accepted.
    const acceptedKey = payload && typeof payload === 'object' && 'integration_key' in payload
      ? payload.integration_key : null
    if (typeof acceptedKey !== 'string' || !acceptedKey) throw new Error('Aviso persistido sem autenticação')
    const result = await processPostback(payload, {
      repo: createPostbackRepo(), notify: notifyAccess, integrationKey: acceptedKey, eventId,
    })
    if (result.kind === 'processed') {
      const errors = [...result.emailErrors]
      if (result.unknownCodes.length) errors.push(`Produtos desconhecidos: ${result.unknownCodes.join(', ')}`)
      if (errors.length) throw new Error(errors.join(' | '))
    }
    if (result.kind === 'invalid' || result.kind === 'unauthorized') throw new Error('Aviso persistido inválido')
    return result
  })
}
