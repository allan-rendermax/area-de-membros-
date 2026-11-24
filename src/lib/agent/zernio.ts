export type ZernioClient = {
  send(input: { conversationId: string; accountId: string; text: string; humanAgent?: boolean }): Promise<{ messageId: string }>
}

export function createZernioClient(apiKey: string, fetchImpl: typeof fetch = fetch): ZernioClient {
  return {
    async send({ conversationId, accountId, text, humanAgent }) {
      try {
        const response = await fetchImpl(`https://zernio.com/api/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, message: text, ...(humanAgent ? { messagingType: 'MESSAGE_TAG', messageTag: 'HUMAN_AGENT' } : {}) }),
          signal: AbortSignal.timeout(8000),
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('zernio_send_failed')
        const body = await response.json()
        const messageId = body?.data?.messageId ?? body?.messageId
        if (typeof messageId !== 'string' || !messageId.trim()) throw new Error('zernio_send_failed')
        return { messageId }
      } catch { throw new Error('zernio_send_failed') }
    },
  }
}
