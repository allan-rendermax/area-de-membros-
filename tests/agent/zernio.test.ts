import { afterEach, describe, expect, it, vi } from 'vitest'
import { createZernioClient } from '@/lib/agent/zernio'

const input = { conversationId: 'conversation-1', accountId: 'acc', text: 'oi' }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('cliente Zernio', () => {
  it('envia texto na conversa', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ data: { messageId: 'message-1' } }))
    const signal = new AbortController().signal
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal)

    await expect(createZernioClient('k', fetch).send(input)).resolves.toEqual({ messageId: 'message-1' })

    expect(fetch).toHaveBeenCalledExactlyOnceWith('https://zernio.com/api/v1/inbox/conversations/conversation-1/messages', {
      method: 'POST', headers: { Authorization: 'Bearer k', 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc', message: 'oi' }), signal, cache: 'no-store',
    })
    expect(timeout).toHaveBeenCalledExactlyOnceWith(8000)
  })

  it('marca HUMAN_AGENT quando pedido', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ data: { messageId: 'message-1' } }))
    await createZernioClient('k', fetch).send({ ...input, humanAgent: true })
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({
      accountId: 'acc', message: 'oi', messagingType: 'MESSAGE_TAG', messageTag: 'HUMAN_AGENT',
    })
  })

  it('não marca HUMAN_AGENT quando explicitamente falso', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ data: { messageId: 'message-1' } }))
    await createZernioClient('k', fetch).send({ ...input, humanAgent: false })
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({ accountId: 'acc', message: 'oi' })
  })

  it('codifica o ID da conversa como um segmento da URL', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ data: { messageId: 'message-1' } }))
    await createZernioClient('k', fetch).send({ ...input, conversationId: 'id/with ?#' })
    expect(fetch.mock.calls[0][0]).toBe('https://zernio.com/api/v1/inbox/conversations/id%2Fwith%20%3F%23/messages')
  })

  it('aceita messageId na raiz e usa fetch global por padrão', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ messageId: 'root-message' }))
    vi.stubGlobal('fetch', fetch)
    await expect(createZernioClient('k').send(input)).resolves.toEqual({ messageId: 'root-message' })
  })

  it('prioriza o ID de data quando ambos os formatos estão presentes', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ data: { messageId: 'nested-message' }, messageId: 'root-message' }))
    await expect(createZernioClient('k', fetch).send(input)).resolves.toEqual({ messageId: 'nested-message' })
  })

  it.each([null, {}, { data: {} }, { messageId: '' }, { messageId: '   ' }, { messageId: 123 }, { data: { messageId: '' } }, { data: { messageId: '  ' } }, { data: { messageId: false } }])('recusa sucesso sem ID válido: %j', body => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(body))
    return expect(createZernioClient('k', fetch).send(input)).rejects.toEqual(new Error('zernio_send_failed'))
  })

  it('erro não expõe resposta do provedor', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ data: { messageId: 'message-1' }, error: 'private-provider-body' }, { status: 403 }))
    const error = await createZernioClient('k', fetch).send(input).catch(error => error)
    expect(error).toEqual(new Error('zernio_send_failed'))
    expect(error).not.toHaveProperty('cause')
  })

  it('oculta erro de transporte e não repete envio com resultado incerto', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('private-api-key and customer text'))
    await expect(createZernioClient('k', fetch).send(input)).rejects.toEqual(new Error('zernio_send_failed'))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('oculta erro de timeout', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new DOMException('private-timeout-details', 'TimeoutError'))
    await expect(createZernioClient('k', fetch).send(input)).rejects.toEqual(new Error('zernio_send_failed'))
  })

  it('oculta resposta que não é JSON válido', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('private-invalid-json'))
    await expect(createZernioClient('k', fetch).send(input)).rejects.toEqual(new Error('zernio_send_failed'))
  })
})
