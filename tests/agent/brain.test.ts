import Anthropic from '@anthropic-ai/sdk'
import type { BetaMessage, BetaMessageParam, BetaToolResultBlockParam, BetaToolUseBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCallModel, runAgent, type AgentTools, type CallModel } from '@/lib/agent/brain'
import { buildSystemPrompt } from '@/lib/agent/prompt'

function tool(name: string, input: unknown, id = name): BetaToolUseBlock {
  return { type: 'tool_use', name, input, id }
}

function response(content: BetaMessage['content'], stop_reason: BetaMessage['stop_reason'] = 'tool_use'): BetaMessage {
  return {
    id: 'msg-test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content, stop_reason,
    stop_sequence: null, stop_details: null, container: null, context_management: null, diagnostics: null,
    usage: {
      input_tokens: 10, output_tokens: 5, cache_creation: null, cache_creation_input_tokens: null,
      cache_read_input_tokens: null, fallback_credit: null, inference_geo: null, iterations: null,
      output_tokens_details: null, server_tool_use: null, service_tier: null, speed: null,
    },
  }
}

function harness(script: BetaMessage[]) {
  const tools = {
    buscar_compra: vi.fn<AgentTools['buscar_compra']>().mockResolvedValue({ found: true, customerId: 'customer-test', products: ['Atlas'], lastNotice: 'sent' }),
    reenviar_acesso: vi.fn<AgentTools['reenviar_acesso']>().mockResolvedValue({ ok: true }),
    escalar: vi.fn<AgentTools['escalar']>().mockResolvedValue({ ok: true }),
    responder: vi.fn<AgentTools['responder']>().mockResolvedValue({ ok: true }),
  }
  const calls: Parameters<CallModel>[0][] = []
  const callModel = vi.fn<CallModel>(async params => {
    // Keep each request as sent; the loop subsequently appends to its history.
    calls.push({ ...params, messages: [...params.messages] })
    const next = script.shift()
    if (!next) throw new Error('unexpected_model_call')
    return next
  })
  const input = { system: 'instruções', messages: [{ role: 'user' as const, text: 'Valor' }], tools, callModel }
  return { tools, calls, callModel, input }
}

function results(message: BetaMessageParam): BetaToolResultBlockParam[] {
  if (!Array.isArray(message.content)) throw new Error('expected tool results')
  const blocks: BetaToolResultBlockParam[] = []
  for (const block of message.content) {
    if (block.type === 'tool_result') blocks.push(block)
  }
  return blocks
}

afterEach(() => { vi.restoreAllMocks() })

describe('cérebro do agente', () => {
  it('responde dúvida de preço com uma chamada a responder', async () => {
    const h = harness([response([tool('responder', { texto: 'O Básico custa R$ 19,90 😊' })])])
    expect(await runAgent(h.input)).toEqual({ replied: true, escalated: false })
    expect(h.tools.responder).toHaveBeenCalledExactlyOnceWith('O Básico custa R$ 19,90 😊')
    expect(h.tools.escalar).not.toHaveBeenCalled()
    expect(h.callModel).toHaveBeenCalledTimes(1)
  })

  it('não reenvia sem buscar_compra encontrado antes', async () => {
    const h = harness([
      response([tool('reenviar_acesso', { email: 'cliente@example.com' })]),
      response([tool('escalar', { motivo: 'compra_nao_encontrada', resumo: 'Não localizou a compra.' })]),
    ])
    expect(await runAgent(h.input)).toEqual({ replied: false, escalated: true })
    expect(h.tools.reenviar_acesso).not.toHaveBeenCalled()
    expect(results(h.calls[1].messages.at(-1)!)[0]).toMatchObject({ tool_use_id: 'reenviar_acesso', is_error: true })
  })

  it('segunda chamada a responder é ignorada', async () => {
    const h = harness([response([
      tool('responder', { texto: 'Primeira' }, 'reply-1'), tool('responder', { texto: 'Segunda' }, 'reply-2'),
    ])])
    expect(await runAgent(h.input)).toEqual({ replied: true, escalated: false })
    expect(h.tools.responder).toHaveBeenCalledExactlyOnceWith('Primeira')
    expect(h.calls[0].messages).toEqual([{ role: 'user', content: 'Valor' }])
    // The fake also sees the live history, including the terminal tool results.
    const live = h.callModel.mock.calls[0][0].messages
    expect(results(live.at(-1)!)[1]).toMatchObject({ tool_use_id: 'reply-2', is_error: true, content: expect.stringContaining('já respondido') })
  })

  it('passa de 6 passos e escala', async () => {
    const h = harness(Array.from({ length: 7 }, (_, i) => response([tool('buscar_compra', { email: 'cliente@example.com' }, `lookup-${i}`)])))
    expect(await runAgent(h.input)).toEqual({ replied: false, escalated: true })
    expect(h.callModel).toHaveBeenCalledTimes(6)
    expect(h.tools.escalar).toHaveBeenCalledExactlyOnceWith('sem_solucao', expect.any(String))
  })

  it.each([1, 3, 12])('respeita maxSteps=%s sem ultrapassar seis chamadas', async maxSteps => {
    const h = harness(Array.from({ length: 8 }, () => response([tool('buscar_compra', { email: 'cliente@example.com' })])))
    await runAgent({ ...h.input, maxSteps })
    expect(h.callModel).toHaveBeenCalledTimes(Math.min(maxSteps, 6))
    expect(h.tools.escalar).toHaveBeenCalledExactlyOnceWith('sem_solucao', expect.any(String))
  })

  it.each([
    new Error('segredo do cliente'),
    new Anthropic.APIError(400, { error: { message: 'bad request' } }, 'bad request', new Headers()),
  ])('erro da API escala com motivo erro_modelo (%s)', async error => {
    const h = harness([])
    h.callModel.mockRejectedValueOnce(error)
    expect(await runAgent(h.input)).toEqual({ replied: false, escalated: true })
    expect(h.tools.escalar).toHaveBeenCalledExactlyOnceWith('outro', expect.stringContaining('erro_modelo'))
  })

  it('normaliza o mesmo e-mail e executa todos os blocos em ordem, preservando thinking', async () => {
    const content: BetaMessage['content'] = [
      { type: 'thinking', thinking: 'Consultar e reenviar.', signature: 'assinatura-original' },
      { type: 'redacted_thinking', data: 'opaque-data' },
      tool('buscar_compra', { email: ' Cliente@Example.com ' }, 'lookup'),
      tool('reenviar_acesso', { email: 'CLIENTE@example.com' }, 'resend'),
    ]
    const h = harness([response(content), response([tool('responder', { texto: 'Se esse e-mail tiver compra, o acesso foi reenviado para ele.' })])])
    await runAgent(h.input)
    expect(h.tools.buscar_compra).toHaveBeenCalledExactlyOnceWith('cliente@example.com')
    expect(h.tools.reenviar_acesso).toHaveBeenCalledExactlyOnceWith('cliente@example.com')
    expect(h.tools.buscar_compra.mock.invocationCallOrder[0]).toBeLessThan(h.tools.reenviar_acesso.mock.invocationCallOrder[0])
    expect(h.calls[1].messages).toHaveLength(3)
    expect(h.calls[1].messages[1]).toEqual({ role: 'assistant', content })
    expect(h.calls[1].messages[1].content).toBe(content)
    expect(results(h.calls[1].messages[2])).toEqual([
      { type: 'tool_result', tool_use_id: 'lookup', content: JSON.stringify({ found: true, customerId: 'customer-test', products: ['Atlas'], lastNotice: 'sent' }) },
      { type: 'tool_result', tool_use_id: 'resend', content: JSON.stringify({ ok: true }) },
    ])
  })

  it.each(['outro@example.com', 'cliente@example.com'])('bloqueia reenvio para %s se a busca não o autorizou', async email => {
    const h = harness([
      response([tool('buscar_compra', { email: 'cliente@example.com' }), tool('reenviar_acesso', { email })]),
      response([tool('escalar', { motivo: 'compra_nao_encontrada', resumo: 'Sem compra confirmada.' })]),
    ])
    if (email === 'cliente@example.com') h.tools.buscar_compra.mockResolvedValueOnce({ found: false })
    await runAgent(h.input)
    expect(h.tools.reenviar_acesso).not.toHaveBeenCalled()
    expect(results(h.calls[1].messages.at(-1)!)[1].is_error).toBe(true)
  })

  it('não reaproveita a autorização de compra em outra execução', async () => {
    const h = harness([
      response([tool('buscar_compra', { email: 'cliente@example.com' }), tool('responder', { texto: 'Ok' })]),
      response([tool('reenviar_acesso', { email: 'cliente@example.com' })]),
      response([tool('escalar', { motivo: 'compra_nao_encontrada', resumo: 'Precisa buscar novamente.' })]),
    ])
    await runAgent(h.input)
    await runAgent(h.input)
    expect(h.tools.reenviar_acesso).not.toHaveBeenCalled()
  })

  it.each([
    ['buscar_compra', { email: 'inválido' }],
    ['reenviar_acesso', { email: 'cliente@example.com', extra: true }],
    ['responder', { texto: '' }],
    ['responder', '{"texto":"JSON não parseado"}'],
    ['escalar', { motivo: 'inventado', resumo: 'x' }],
    ['escalar', { motivo: 'outro' }],
    ['ferramenta_inventada', {}],
  ])('recusa entrada inválida em %s e devolve tool_result de erro', async (name, input) => {
    const h = harness([response([tool(name, input, 'invalid')]), response([tool('responder', { texto: 'Vou verificar.' })])])
    await runAgent(h.input)
    expect(results(h.calls[1].messages.at(-1)!)[0]).toMatchObject({ tool_use_id: 'invalid', is_error: true })
    expect(h.tools.buscar_compra).not.toHaveBeenCalled()
    expect(h.tools.reenviar_acesso).not.toHaveBeenCalled()
    expect(h.tools.escalar).not.toHaveBeenCalled()
    expect(h.tools.responder).toHaveBeenCalledExactlyOnceWith('Vou verificar.')
  })

  it('devolve erro de ferramenta sem expor a exceção e continua o laço', async () => {
    const h = harness([
      response([tool('buscar_compra', { email: 'cliente@example.com' }, 'failed'), tool('buscar_compra', { email: 'outro@example.com' }, 'next')]),
      response([tool('escalar', { motivo: 'outro', resumo: 'Erro na consulta.' })]),
    ])
    h.tools.buscar_compra.mockRejectedValueOnce(new Error('cliente@example.com dado privado'))
    await runAgent(h.input)
    const blocks = results(h.calls[1].messages.at(-1)!)
    expect(blocks[0]).toMatchObject({ tool_use_id: 'failed', is_error: true })
    expect(blocks[0].content).not.toContain('cliente@example.com')
    expect(blocks[1]).toMatchObject({ tool_use_id: 'next' })
    expect(h.tools.buscar_compra).toHaveBeenCalledTimes(2)
  })

  it('não tenta enviar de novo quando responder lança erro', async () => {
    const h = harness([
      response([tool('responder', { texto: 'Primeira' }, 'first'), tool('responder', { texto: 'Segunda' }, 'second')]),
      response([tool('escalar', { motivo: 'outro', resumo: 'Envio incerto.' })]),
    ])
    h.tools.responder.mockRejectedValueOnce(new Error('envio incerto'))
    expect(await runAgent(h.input)).toEqual({ replied: false, escalated: true })
    expect(h.tools.responder).toHaveBeenCalledExactlyOnceWith('Primeira')
    expect(results(h.calls[1].messages.at(-1)!)).toEqual([
      expect.objectContaining({ tool_use_id: 'first', is_error: true }),
      expect.objectContaining({ tool_use_id: 'second', is_error: true, content: expect.stringContaining('já respondido') }),
    ])
  })

  it('reenvio recusado volta como erro para o modelo escalar', async () => {
    const h = harness([
      response([tool('buscar_compra', { email: 'cliente@example.com' }), tool('reenviar_acesso', { email: 'cliente@example.com' })]),
      response([tool('escalar', { motivo: 'reenvio_recusado', resumo: 'Cota insuficiente.' })]),
    ])
    h.tools.reenviar_acesso.mockResolvedValueOnce({ ok: false, reason: 'cota' })
    await runAgent(h.input)
    expect(results(h.calls[1].messages.at(-1)!)[1]).toMatchObject({ is_error: true, content: JSON.stringify({ ok: false, reason: 'cota' }) })
    expect(h.tools.escalar).toHaveBeenCalledExactlyOnceWith('reenvio_recusado', 'Cota insuficiente.')
  })

  it('end_turn sem ferramenta recebe um lembrete e pode responder na chamada seguinte', async () => {
    const h = harness([
      response([{ type: 'text', text: 'Resposta que não deve ser enviada diretamente', citations: null }], 'end_turn'),
      response([tool('responder', { texto: 'Resposta pela ferramenta' })]),
    ])
    expect(await runAgent(h.input)).toEqual({ replied: true, escalated: false })
    expect(h.calls[1].messages.at(-1)).toEqual({ role: 'user', content: 'Use a ferramenta responder ou escalar para terminar.' })
    expect(h.tools.responder).toHaveBeenCalledExactlyOnceWith('Resposta pela ferramenta')
  })

  it('segundo end_turn sem ferramenta escala sem_solucao', async () => {
    const h = harness([response([], 'end_turn'), response([], 'end_turn')])
    expect(await runAgent(h.input)).toEqual({ replied: false, escalated: true })
    expect(h.callModel).toHaveBeenCalledTimes(2)
    expect(h.tools.escalar).toHaveBeenCalledExactlyOnceWith('sem_solucao', expect.any(String))
    expect(h.calls[1].messages.filter(m => m.content === 'Use a ferramenta responder ou escalar para terminar.')).toHaveLength(1)
  })

  it.each(['refusal', 'max_tokens'] as const)('%s escala outro sem executar conteúdo incompleto', async reason => {
    const h = harness([response([tool('responder', { texto: 'Não enviar' })], reason)])
    expect(await runAgent(h.input)).toEqual({ replied: false, escalated: true })
    expect(h.tools.escalar).toHaveBeenCalledExactlyOnceWith('outro', expect.stringContaining(reason))
    expect(h.tools.responder).not.toHaveBeenCalled()
  })

  it('processa todo o lote e para na volta seguinte ao escalar', async () => {
    const h = harness([response([
      tool('escalar', { motivo: 'reembolso', resumo: 'Pediu reembolso.' }, 'escalate'),
      tool('responder', { texto: 'Vou verificar com a equipe.' }, 'reply'),
    ])])
    expect(await runAgent(h.input)).toEqual({ replied: true, escalated: true })
    expect(h.tools.escalar).toHaveBeenCalledExactlyOnceWith('reembolso', 'Pediu reembolso.')
    expect(h.tools.responder).toHaveBeenCalledExactlyOnceWith('Vou verificar com a equipe.')
    expect(h.callModel).toHaveBeenCalledTimes(1)
  })

  it('converte o histórico, descarta assistants iniciais e junta papéis consecutivos', async () => {
    const h = harness([response([tool('responder', { texto: 'Ok' })])])
    const messages = [
      { role: 'assistant' as const, text: 'automação inicial' }, { role: 'assistant' as const, text: 'mais automação' },
      { role: 'user' as const, text: 'Oi' }, { role: 'user' as const, text: 'Valor?' },
      { role: 'assistant' as const, text: 'Olá' }, { role: 'assistant' as const, text: 'Qual Atlas?' },
      { role: 'user' as const, text: 'Patologias' },
    ]
    await runAgent({ ...h.input, messages })
    expect(h.calls[0].messages).toEqual([
      { role: 'user', content: 'Oi\nValor?' }, { role: 'assistant', content: 'Olá\nQual Atlas?' }, { role: 'user', content: 'Patologias' },
    ])
    expect(messages).toHaveLength(7)
  })

  it('expõe apenas as quatro ferramentas com esquema estrito e argumentos obrigatórios', async () => {
    const h = harness([response([tool('responder', { texto: 'Ok' })])])
    await runAgent(h.input)
    expect(h.calls[0].tools.map(t => t.name)).toEqual(['buscar_compra', 'reenviar_acesso', 'escalar', 'responder'])
    for (const t of h.calls[0].tools) {
      expect(t.strict).toBe(true)
      expect(t.input_schema).toMatchObject({ type: 'object', additionalProperties: false })
      expect(t.input_schema.required).toEqual(t.name === 'escalar' ? ['motivo', 'resumo'] : t.name === 'responder' ? ['texto'] : ['email'])
    }
    expect(h.calls[0].tools[2].input_schema.properties).toMatchObject({ motivo: { enum: [
      'reembolso', 'ameaca', 'compra_nao_encontrada', 'hotmart', 'troca_de_email', 'reenvio_recusado', 'fora_do_escopo', 'reclamacao', 'sem_solucao', 'outro',
    ] } })
  })
})

describe('instruções', () => {
  it('instruções contêm R$ 19,90 vindo do banco e a regra de não corrigir e-mail', () => {
    const prompt = buildSystemPrompt({ knowledge: [{ topic: 'Patologias', rule: 'Básico R$ 19,90; comprar em https://example.com/atlas' }], platform: 'instagram', today: '2026-11-24' })
    expect(prompt).toContain('Patologias: Básico R$ 19,90; comprar em https://example.com/atlas')
    expect(prompt).toMatch(/nunca corrigir e-mail de cadastro/i)
    for (const text of ['Marina Costa', 'arquiteta', 'instagram', '2026-11-24', 'troca_de_email', 'reembolso', 'Hotmart', 'hotmart', 'Paisagismo', 'Hospitalar', 'fora_do_escopo', 'compra_nao_encontrada', 'reenvio_recusado', 'ameaca', 'reclamacao', 'sem_solucao', '24 horas']) expect(prompt).toContain(text)
    expect(prompt).toMatch(/e-mail digitado serve só para localizar/i)
    expect(prompt).toMatch(/nunca revelar dados de outro cliente/i)
    expect(prompt).toMatch(/nunca dizer ao cliente quais produtos ou detalhes de entrega/i)
    expect(prompt).toMatch(/no máximo uma vez/i)
  })

  it('não fixa preços nem links fora do banco e mantém o prefixo estável entre datas e plataformas', () => {
    const first = buildSystemPrompt({ knowledge: [{ topic: 'Outro', rule: 'R$ 27,00' }], platform: 'facebook', today: '2026-11-24' })
    const next = buildSystemPrompt({ knowledge: [{ topic: 'Outro', rule: 'R$ 27,00' }], platform: 'instagram', today: '2026-11-25' })
    expect(first).not.toContain('R$ 19,90')
    expect(first).not.toMatch(/https?:\/\//)
    expect(first.slice(0, first.indexOf('Outro: R$ 27,00'))).toBe(next.slice(0, next.indexOf('Outro: R$ 27,00')))
    expect(first).toContain('facebook')
    expect(next).toContain('2026-11-25')
  })
})

describe('adaptador do SDK (sem rede)', () => {
  it('usa o SDK beta com fallback, cache, effort medium e tool_choice auto, omitindo thinking', async () => {
    const answer = response([tool('responder', { texto: 'Ok' })])
    const create = vi.spyOn(Anthropic.Beta.Messages.prototype, 'create').mockResolvedValue(answer)
    const h = harness([])
    const callModel = createCallModel('test-key', 'claude-opus-5-5')
    expect(await runAgent({ ...h.input, callModel })).toEqual({ replied: true, escalated: false })
    expect(create).toHaveBeenCalledTimes(1)
    const params = create.mock.calls[0][0]
    expect(params).toMatchObject({
      model: 'claude-opus-5-5', max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [{ type: 'text', text: 'instruções', cache_control: { type: 'ephemeral' } }],
      tool_choice: { type: 'auto' }, output_config: { effort: 'medium' },
    })
    expect(params).not.toHaveProperty('thinking')
    expect(params.tools).toHaveLength(4)
  })
})
