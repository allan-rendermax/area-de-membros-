import Anthropic from '@anthropic-ai/sdk'
import type { BetaMessage, BetaMessageParam, BetaTool, BetaToolResultBlockParam, BetaToolUseBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { z } from 'zod'

export type AgentTools = {
  buscar_compra(email: string): Promise<unknown>
  reenviar_acesso(email: string): Promise<unknown>
  escalar(motivo: string, resumo: string): Promise<unknown>
  responder(texto: string): Promise<unknown>
}

export type CallModel = (params: {
  system: string
  tools: BetaTool[]
  messages: BetaMessageParam[]
}) => Promise<BetaMessage>

export function createCallModel(apiKey: string, model: string): CallModel {
  const client = new Anthropic({ apiKey, timeout: 20000, maxRetries: 1 })
  // Haiku 5.5 recusa `fallbacks` com 400; os demais modelos usam o reencaminhamento do servidor.
  const fallback = model.startsWith('claude-haiku-')
    ? {}
    : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
  return async ({ system, tools, messages }) => client.beta.messages.create({
    model,
    max_tokens: 16000,
    ...fallback,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    tools,
    tool_choice: { type: 'auto' },
    output_config: { effort: 'medium' },
    messages,
  })
}

const escalationReasons = [
  'reembolso', 'ameaca', 'compra_nao_encontrada', 'hotmart', 'troca_de_email',
  'reenvio_recusado', 'fora_do_escopo', 'reclamacao', 'sem_solucao', 'outro',
] as const

const emailInput = z.strictObject({ email: z.string().trim().toLowerCase().pipe(z.email()) })
const escalationInput = z.strictObject({ motivo: z.enum(escalationReasons), resumo: z.string().trim().min(1) })
const replyInput = z.strictObject({ texto: z.string().trim().min(1) })
const toolInput = z.discriminatedUnion('name', [
  z.object({ name: z.literal('buscar_compra'), input: emailInput }),
  z.object({ name: z.literal('reenviar_acesso'), input: emailInput }),
  z.object({ name: z.literal('escalar'), input: escalationInput }),
  z.object({ name: z.literal('responder'), input: replyInput }),
])

const toolDefinitions: BetaTool[] = [
  {
    name: 'buscar_compra', strict: true,
    description: 'Localiza a compra pelo e-mail. Devolve apenas se encontrou; não comprova a identidade do cliente.',
    input_schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } }, required: ['email'], additionalProperties: false },
  },
  {
    name: 'reenviar_acesso', strict: true,
    description: 'Reenvia para o e-mail cadastrado, somente após buscar_compra confirmar o mesmo e-mail. Recusa ou incerteza exige escalar reenvio_recusado.',
    input_schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } }, required: ['email'], additionalProperties: false },
  },
  {
    name: 'escalar', strict: true,
    description: 'Encaminha ao atendimento humano, já avisa o cliente e encerra a execução. Não chame responder junto. Resuma só o necessário, sem dados pessoais desnecessários.',
    input_schema: {
      type: 'object', properties: { motivo: { type: 'string', enum: [...escalationReasons] }, resumo: { type: 'string' } },
      required: ['motivo', 'resumo'], additionalProperties: false,
    },
  },
  {
    name: 'responder', strict: true,
    description: 'Envia uma mensagem curta em pt-BR ao cliente; no máximo uma vez por execução. Para encaminhar ao humano, use apenas escalar, que já avisa o cliente.',
    input_schema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'], additionalProperties: false },
  },
]

type LocalMessage = { role: 'user' | 'assistant'; text: string }

function modelHistory(history: LocalMessage[]): BetaMessageParam[] {
  const messages: { role: 'user' | 'assistant'; content: string }[] = []
  for (const message of history) {
    if (!messages.length && message.role === 'assistant') continue
    const previous = messages.at(-1)
    if (previous?.role === message.role) previous.content += `\n${message.text}`
    else messages.push({ role: message.role, content: message.text })
  }
  return messages
}

function isFailure(result: unknown): boolean {
  return typeof result === 'object' && result !== null && 'ok' in result && result.ok === false
}

export async function runAgent(input: {
  system: string
  messages: LocalMessage[]
  tools: AgentTools
  callModel: CallModel
  maxSteps?: number
  deadline: Date
  now?: () => Date
}): Promise<{ replied: boolean; escalated: boolean }> {
  const messages = modelHistory(input.messages)
  const foundEmails = new Set<string>()
  const requestedSteps = input.maxSteps ?? 6
  const maxSteps = Number.isInteger(requestedSteps) && requestedSteps >= 0 ? Math.min(requestedSteps, 6) : 6
  let replied = false
  let escalated = false
  let escalationFailed = false
  let replyAttempted = false
  let reminderSent = false

  async function escalate(motivo: string, resumo: string) {
    const result = await input.tools.escalar(motivo, resumo)
    if (isFailure(result)) throw new Error('escalacao_recusada')
    escalated = true
    return result
  }

  async function executeTool(block: BetaToolUseBlock, deferReply: boolean): Promise<BetaToolResultBlockParam> {
    const base = { type: 'tool_result' as const, tool_use_id: block.id }
    const parsed = toolInput.safeParse({ name: block.name, input: block.input })
    if (!parsed.success) return { ...base, is_error: true, content: 'entrada inválida' }
    const call = parsed.data
    try {
      let result: unknown
      switch (call.name) {
        case 'buscar_compra':
          foundEmails.delete(call.input.email)
          result = await input.tools.buscar_compra(call.input.email)
          if (typeof result === 'object' && result !== null && 'found' in result && result.found === true) foundEmails.add(call.input.email)
          break
        case 'reenviar_acesso':
          if (!foundEmails.has(call.input.email)) return { ...base, is_error: true, content: 'buscar_compra precisa encontrar o mesmo e-mail nesta execução' }
          result = await input.tools.reenviar_acesso(call.input.email)
          break
        case 'responder':
          if (escalated) return { ...base, is_error: true, content: 'já escalado; cliente já avisado' }
          if (deferReply) return { ...base, is_error: true, content: 'aguarde o resultado das ferramentas antes de responder' }
          if (replyAttempted) return { ...base, is_error: true, content: 'já respondido' }
          replyAttempted = true
          result = await input.tools.responder(call.input.texto)
          replied = !isFailure(result)
          break
        case 'escalar':
          if (escalated) return { ...base, is_error: true, content: 'já escalado' }
          result = await escalate(call.input.motivo, call.input.resumo)
          break
      }
      return { ...base, content: JSON.stringify(result ?? null), ...(isFailure(result) ? { is_error: true } : {}) }
    } catch {
      if (call.name === 'escalar') escalationFailed = true
      // Do not leak exception messages, which may include customer data.
      return { ...base, is_error: true, content: 'erro_ferramenta' }
    }
  }

  if (!messages.length) {
    await escalate('sem_solucao', 'historico_sem_mensagem_do_cliente')
    return { replied, escalated }
  }

  for (let step = 0; step < maxSteps; step++) {
    if (replied || escalated) break
    if ((input.now?.() ?? new Date()).getTime() >= input.deadline.getTime()) {
      await escalate('sem_solucao', 'tempo_esgotado')
      break
    }
    let response: BetaMessage
    try {
      response = await input.callModel({ system: input.system, tools: toolDefinitions, messages })
    } catch {
      await escalate('outro', 'erro_modelo')
      break
    }

    if (response.stop_reason === 'tool_use') {
      const deferReply = response.content.some(block => block.type === 'tool_use' && (block.name === 'buscar_compra' || block.name === 'reenviar_acesso'))
      const results: BetaToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') results.push(await executeTool(block, deferReply))
      }
      // Keep every block, in order, including opaque thinking signatures.
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: results })
    } else if (response.stop_reason === 'end_turn') {
      if (reminderSent) {
        await escalate('sem_solucao', 'modelo_terminou_sem_responder_ou_escalar')
        break
      }
      if (response.content.length) messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: 'Use a ferramenta responder ou escalar para terminar.' })
      reminderSent = true
    } else {
      await escalate('outro', `modelo_stop_reason:${response.stop_reason}`)
      break
    }
  }

  if (!escalated && (!replied || escalationFailed)) {
    await escalate('sem_solucao', escalationFailed ? 'falha_ao_escalar' : 'limite_de_chamadas_ao_modelo')
  }
  return { replied, escalated }
}
