import Anthropic from '@anthropic-ai/sdk'
import type { Message } from '@anthropic-ai/sdk/resources/messages'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLearn } from '@/lib/agent/learn'
import type { AgentMessage } from '@/lib/agent/types'

afterEach(() => vi.restoreAllMocks())
const recent: AgentMessage[] = [{ id: 'incoming', direction: 'in', author: 'cliente', text: 'O e-mail é cliente@example.test', createdAt: new Date('2026-11-24T15:00:00Z') }]
const input = { reply: 'Confira o e-mail usado na compra.', recent }
function response(value: unknown): Message {
  return {
    id: 'message', type: 'message', role: 'assistant', model: 'test-model', content: [{ type: 'text', text: JSON.stringify(value), citations: null }],
    stop_reason: 'end_turn', stop_sequence: null, stop_details: null, container: null, diagnostics: null,
    usage: {
      input_tokens: 20, output_tokens: 10, cache_creation: null, cache_creation_input_tokens: null, cache_read_input_tokens: null,
      inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null, speed: null,
    },
  }
}
function setup(value: unknown = { geral: true, tema: 'acesso', regra: 'Confira o e-mail usado na compra.' }) {
  const create = vi.spyOn(Anthropic.Messages.prototype, 'create').mockResolvedValue(response(value))
  const learn = createLearn('test-key', 'configured-model')
  return { create, learn }
}

describe('createLearn sem rede', () => {
  it('usa SDK oficial, configuração exata e JSON Schema estrito sem thinking ou temperature', async () => {
    const h = setup()
    expect(await h.learn(input)).toEqual({ general: true, topic: 'acesso', rule: 'Confira o e-mail usado na compra.' })
    expect(h.create).toHaveBeenCalledTimes(1)
    const params = h.create.mock.calls[0][0]
    expect(params).toMatchObject({ model: 'configured-model', max_tokens: 2000, output_config: {
      effort: 'low', format: { type: 'json_schema', schema: {
        type: 'object', additionalProperties: false, required: ['geral', 'tema', 'regra'],
        properties: { geral: { type: 'boolean' }, tema: { type: 'string' }, regra: { type: 'string' } },
      } },
    } })
    expect(params).not.toHaveProperty('thinking')
    expect(params).not.toHaveProperty('temperature')
    const client = Reflect.get(h.create.mock.contexts[0] as object, '_client') as Anthropic
    expect(client.apiKey).toBe('test-key')
    expect(client.timeout).toBe(20000)
    expect(client.maxRetries).toBe(1)
    expect(params.system).toEqual(expect.stringContaining('preço'))
    for (const text of ['política', 'link', 'procedimento', 'nome', 'e-mail', 'telefone', 'número de pedido', 'pessoal']) expect(params.system).toEqual(expect.stringContaining(text))
    expect(params.messages).toEqual([{ role: 'user', content: expect.stringContaining(input.reply) }])
    expect(params.messages[0].content).toEqual(expect.stringContaining(recent[0].text))
  })

  it('regra aprendida não contém o e-mail do cliente', async () => {
    const h = setup({ geral: true, tema: 'acesso', regra: 'Reenvie para cliente@example.test.' })
    expect(await h.learn(input)).toEqual({ general: false })
  })

  it.each(['Ligue para 11999998888.', 'Pedido 123456 liberado.', 'Contato CLIENTE+tag@EXAMPLE.COM'])('recusa dado pessoal na regra: %s', async regra => {
    const h = setup({ geral: true, tema: 'acesso', regra })
    expect(await h.learn(input)).toEqual({ general: false })
  })

  it('caso pessoal não vira regra', async () => {
    const h = setup({ geral: false, tema: '', regra: '' })
    expect(await h.learn(input)).toEqual({ general: false })
  })

  it.each([
    { geral: 'true', tema: 'acesso', regra: 'Regra' },
    { geral: true, tema: 'acesso' },
    { geral: true, tema: 3, regra: 'Regra' },
    { geral: true, tema: 'acesso', regra: 'Regra', extra: true },
    { geral: true, tema: '', regra: 'Regra' },
    { geral: true, tema: 'acesso', regra: '  ' },
  ])('valida JSON com zod e recusa saída inválida: %j', async value => {
    const h = setup(value)
    expect(await h.learn(input)).toEqual({ general: false })
  })

  it('lê apenas o primeiro bloco text depois de blocos não text', async () => {
    const h = setup(), answer = response({ geral: true, tema: 'acesso', regra: 'Regra geral.' })
    answer.content.unshift({ type: 'thinking', thinking: 'análise', signature: 'test' })
    answer.content.push({ type: 'text', text: 'não é JSON', citations: null })
    h.create.mockResolvedValueOnce(answer)
    expect(await h.learn(input)).toEqual({ general: true, topic: 'acesso', rule: 'Regra geral.' })
  })

  it.each(['json', 'vazio', 'erro'])('falha %s vira general:false sem lançar', async failure => {
    const h = setup()
    if (failure === 'erro') h.create.mockRejectedValueOnce(new Error('dados privados'))
    else {
      const answer = response(null)
      answer.content = failure === 'vazio' ? [] : [{ type: 'text', text: 'JSON quebrado', citations: null }]
      h.create.mockResolvedValueOnce(answer)
    }
    expect(await h.learn(input)).toEqual({ general: false })
  })
})
