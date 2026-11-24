# Agente de suporte no direct (Marina Costa) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um agente que responde sozinho o direct do Instagram e o Messenger da Marina Costa, resolve o "não recebi" reenviando o acesso, escala ao Allan pelo Telegram e aprende com as respostas dele.

**Architecture:** A Zernio chama `POST /api/webhooks/zernio`; a rota grava a mensagem e agenda o processamento com `after()`. O processamento monta o contexto e roda um laço de ferramentas na API da Anthropic (buscar compra, reenviar acesso, escalar, responder). Reenvio e consulta reaproveitam `createPlatformOperations` do bot do Telegram; escalações e aprendizado passam pelo webhook do Telegram já existente.

**Tech Stack:** Next.js 16.4.3 (App Router, `after`), Supabase (service_role, RLS), zod, vitest + pglite, API da Anthropic (Messages com tool use), API da Zernio.

**Spec:** `docs/superpowers/specs/2026-11-24-agente-suporte-dm-design.md`

## Global Constraints

- Antes de escrever rota ou `after()`, ler o guia em `node_modules/next/dist/docs/` (AGENTS.md). Antes de escrever a chamada à Anthropic, carregar a skill `claude-api`.
- Trabalhar só no worktree `worktrees-area-de-membros/agente-suporte-dm`, branch `feat/agente-suporte-dm`. Commit e push só com ok do Allan; publicar em produção só com ok do Allan.
- Contas atendidas (Zernio): Instagram `6b05a6a49f8d271e5d1941a2`, Facebook `6b05a8f01de1f94249e842e8`. Loja: `arquitetura`.
- O agente nunca responde fora de 24 h da última mensagem do cliente. `HUMAN_AGENT` (até 7 dias) só nas respostas digitadas pelo Allan.
- Limites de reenvio do agente: 20 por dia, 1 por conversa a cada 24 h, e nenhum quando restarem menos de 30 na cota diária (`env.emailDailyLimit`).
- O agente nunca corrige e-mail de cadastro, nunca devolve sugestões de e-mails parecidos, nunca reenvia para endereço diferente do cadastrado.
- Só proprietários (`teamOwners()`) recebem escalações, respondem clientes e ensinam o agente.
- Nenhum dado de cliente (e-mail, nome, texto) em `console.*` ou logs de aplicação.
- Textos ao cliente em pt-BR, voz da Marina, tom vendedor e caloroso com poucos emojis. Preços e links só do banco de respostas.
- Variáveis novas: `ZERNIO_API_KEY`, `ZERNIO_WEBHOOK_SECRET` (32+ caracteres), `ANTHROPIC_API_KEY`, `AGENT_MODEL` (padrão definido na Task 5), `AGENT_ACCOUNT_IDS` (vírgula), `AGENT_STORE_SLUG` (padrão `arquitetura`), `AGENT_BATCH_SECONDS` (padrão 8).

## Review Focus

1. Zernio repete o mesmo webhook (até 7 tentativas): o cliente recebe uma resposta só. Teste na Task 3.
2. Cliente manda 3 mensagens em 5 segundos: uma resposta só, considerando as 3. Teste na Task 7.
3. Mensagem chega numa conversa escalada: o agente não responde e o Allan recebe a mensagem nova no Telegram. Teste na Task 7.
4. `message.sent` de uma resposta do próprio agente não pausa a conversa; só envio feito fora do agente pausa por 24 h. Teste na Task 3.
5. Cliente digita e-mail de outra pessoa ou inexistente: nada é revelado e nada é enviado ao e-mail digitado; depois de uma tentativa sem achar, escala. Teste na Task 6.

---

### Task 1: Banco de dados do agente

**Files:**
- Create: `supabase/migrations/20261124010000_support_agent.sql`
- Test: `tests/agent/storage.test.ts` (seguir o padrão pglite de `tests/telegram/storage.test.ts`)

**Interfaces:**
- Produces (tabelas, todas com RLS e privilégios só para `service_role`, como em `20261025010000_telegram_support.sql`):
  - `agent_settings(store_id uuid pk, enabled boolean default false, updated_at)`.
  - `agent_conversations(id text pk /* conversationId Zernio */, store_id, account_id text, platform text check in ('instagram','facebook'), customer_name text, state text check in ('active','escalated','paused') default 'active', paused_until timestamptz, last_incoming_at timestamptz, created_at)`.
  - `agent_messages(id text pk /* message id Zernio */, conversation_id fk, direction text check in ('in','out'), author text check in ('cliente','agente','allan'), text text, created_at)`.
  - `agent_escalations(id uuid pk, conversation_id fk, reason text, telegram_chat_id bigint, telegram_message_id bigint, state text check in ('open','answered') default 'open', created_at, answered_at)`; índice único `(telegram_chat_id, telegram_message_id)`.
  - `agent_knowledge(id uuid pk, store_id, topic text, rule text, origin text check in ('inicial','allan'), active boolean default true, source_escalation uuid null, uses integer default 0, created_at)`.
  - `telegram_support_actions`: `user_id` e `chat_id` passam a aceitar null; coluna `origin text not null default 'telegram' check in ('telegram','agente')`; check `origin='agente' or (user_id is not null and chat_id is not null)`.
  - `telegram_support_metrics`: `create or replace` mantendo o mesmo retorno e acrescentando `'agentResends'` (ações `origin='agente'`, `state='done'`, `log_id not null`); `'resends'` passa a contar só `origin='telegram'`.
  - Seed de `agent_knowledge` (origin `inicial`) para a loja `arquitetura`, com as entradas da tabela de produtos e da lista "Também entram" do spec (seção "Banco de respostas"), textos exatos de preço e link.

- [ ] **Step 1: Write the failing test** — `tests/agent/storage.test.ts`: aplica todas as migrações no pglite e verifica: `it('aceita ação do agente sem usuário do Telegram')` insere ação `origin='agente'` com `user_id` null; `it('recusa ação do Telegram sem usuário')` espera erro de check; `it('métricas separam reenvios do agente')` cria uma ação telegram e uma agente `done` com `log_id` e espera `resends=1`, `agentResends=1`; `it('seed tem preços dos três Atlas')` espera 3 linhas com `rule` contendo `R$ 19,90` e `R$ 36,90`.
- [ ] **Step 2: Run** `npx vitest run tests/agent/storage.test.ts` — Expected: FAIL (tabelas inexistentes).
- [ ] **Step 3: Write the migration** conforme Interfaces.
- [ ] **Step 4: Run** `npx vitest run tests/agent/storage.test.ts tests/telegram` — Expected: PASS (inclusive os testes antigos do Telegram).
- [ ] **Step 5: Commit** `feat(agente): tabelas e métricas do agente de suporte`.

### Task 2: Configuração e cliente da Zernio

**Files:**
- Create: `src/lib/agent/config.ts`, `src/lib/agent/zernio.ts`, `src/lib/agent/types.ts`
- Test: `tests/agent/config.test.ts`, `tests/agent/zernio.test.ts`

**Interfaces:**
- Produces:
  - `type AgentConfig = { zernioApiKey: string; webhookSecret: string; anthropicApiKey: string; model: string; accountIds: string[]; storeSlug: string; batchSeconds: number; dailyResendLimit: 20; quotaReserve: 30 }`
  - `getAgentConfig(): AgentConfig | null` (null se faltar chave, segredo com menos de 32 caracteres ou nenhuma conta).
  - Em `types.ts`: `type AgentConversation = { id: string; storeId: string; accountId: string; platform: 'instagram'|'facebook'; customerName: string; state: 'active'|'escalated'|'paused'; pausedUntil: Date | null; lastIncomingAt: Date | null }` e `type AgentMessage = { id: string; direction: 'in'|'out'; author: 'cliente'|'agente'|'allan'; text: string; createdAt: Date }`. O histórico vem do registro local (`agent_messages`), não da Zernio.
  - `type ZernioClient = { send(input: { conversationId: string; accountId: string; text: string; humanAgent?: boolean }): Promise<{ messageId: string }> }`
  - `createZernioClient(apiKey: string, fetchImpl = fetch): ZernioClient` — `POST https://zernio.com/api/v1/inbox/conversations/{id}/messages` com `{ accountId, message }`; com `humanAgent` acrescenta `messagingType: 'MESSAGE_TAG', messageTag: 'HUMAN_AGENT'`. Timeout 8 s. Erros viram `Error('zernio_send_failed')` sem corpo bruto.

- [ ] **Step 1: Write the failing tests** — config: `it('retorna null sem ANTHROPIC_API_KEY')`, `it('lê contas separadas por vírgula')`. zernio: `it('envia texto na conversa')` confere URL, header `Authorization: Bearer k`, corpo `{ accountId:'acc', message:'oi' }`; `it('marca HUMAN_AGENT quando pedido')` confere `messageTag`; `it('erro não expõe resposta do provedor')`.
- [ ] **Step 2: Run** `npx vitest run tests/agent/config.test.ts tests/agent/zernio.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** conforme Interfaces (padrão de `src/lib/telegram/config.ts` e `client.ts`).
- [ ] **Step 4: Run** os mesmos testes — Expected: PASS.
- [ ] **Step 5: Commit** `feat(agente): configuração e cliente da Zernio`.

### Task 3: Webhook da Zernio e repositório

**Files:**
- Create: `src/lib/agent/webhook.ts`, `src/lib/agent/repository.ts`, `src/app/api/webhooks/zernio/route.ts`
- Test: `tests/agent/webhook.test.ts`

**Interfaces:**
- Consumes: `getAgentConfig()` (Task 2), tabelas (Task 1).
- Produces:
  - `interface AgentRepository` (implementação Supabase em `repository.ts`; testes usam fake em memória): `recordIncoming(m: { id: string; conversationId: string; accountId: string; platform: 'instagram'|'facebook'; customerName: string; text: string; at: Date }): Promise<boolean /* false se repetido */>`; `isOwnOutgoing(messageId: string): Promise<boolean>`; `recordOutgoing(m: { id: string; conversationId: string; author: 'agente'|'allan'; text: string }): Promise<void>`; `pauseConversation(id: string, until: Date): Promise<void>`; `getConversation(id: string): Promise<AgentConversation | null>`; `recentMessages(id: string, limit: number): Promise<AgentMessage[]>`; `setState(id: string, state: 'active'|'escalated'|'paused'): Promise<void>`; `isEnabled(storeId: string): Promise<boolean>`; `setEnabled(storeId: string, on: boolean): Promise<void>`; `knowledge(storeId: string): Promise<{ id: string; topic: string; rule: string }[]>`; `addKnowledge(k: { storeId: string; topic: string; rule: string; sourceEscalation: string }): Promise<string>`; `deactivateKnowledge(id: string): Promise<boolean>`; `createEscalation(e: { conversationId: string; reason: string; chatId: number; messageId: number }): Promise<string>`; `findEscalationByTelegram(chatId: number, messageId: number): Promise<{ id: string; conversationId: string; state: 'open'|'answered' } | null>`; `answerEscalation(id: string): Promise<void>`; `agentResendsToday(storeId: string): Promise<number>`; `agentResendSince(conversationId: string, since: Date): Promise<boolean>`.
  - `handleZernioWebhook(request: Request, deps: { config: AgentConfig | null; repo: AgentRepository; schedule(conversationId: string, messageId: string): void; now(): Date }): Promise<Response>`.
- Regras: assinatura `X-Zernio-Signature` = HMAC-SHA256 hex do corpo bruto com `timingSafeEqual`, senão 401; corpo acima de 64 KB = 413; sem config = 503. Ignora (200) evento de conta fora de `accountIds`. `message.received` com `direction:'incoming'` → `recordIncoming`; se novo, `schedule(conversationId, messageId)`. `message.sent` → se `!isOwnOutgoing(id)`, `pauseConversation(id, now+24h)` e grava como `author:'allan'`. A rota chama `schedule` via `after(() => processConversation(...))` (Task 7).

- [ ] **Step 1: Write the failing tests** — `it('recusa assinatura inválida com 401')`; `it('grava mensagem recebida e agenda uma vez')`; `it('mesmo webhook repetido não agenda de novo')` (Review Focus 1); `it('ignora conta que não é da Marina')`; `it('envio do próprio agente não pausa a conversa')` e `it('envio feito pelo app pausa por 24 horas')` (Review Focus 4).
- [ ] **Step 2: Run** `npx vitest run tests/agent/webhook.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `webhook.ts`, `repository.ts` e a rota (`runtime='nodejs'`, `maxDuration=60`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(agente): webhook da Zernio`.

### Task 4: Consulta e reenvio para o agente

**Files:**
- Modify: `src/lib/telegram/operations.ts` (parâmetro de `execute`), `src/lib/telegram/types.ts` (`SupportDeps['ops'].execute`)
- Create: `src/lib/agent/purchase.ts`
- Test: `tests/agent/purchase.test.ts`

**Interfaces:**
- Consumes: `createPlatformOperations(storeSlug)` (existente), `AgentRepository.agentResendsToday`/`agentResendSince` (Task 3), `countEmailsUsedToday` (existente).
- Produces:
  - `execute(a: Pick<SupportAction, 'kind' | 'customerId' | 'storeId' | 'expectedEmail' | 'newEmail'>)` — só estreita o tipo; o comportamento não muda.
  - `findPurchase(email: string): Promise<{ found: false } | { found: true; customerId: string; products: string[]; lastNotice: string }>` — usa `lookup`, descarta `suggestions`, `orders` e o e-mail.
  - `resendAccess(input: { email: string; conversationId: string }): Promise<{ ok: true } | { ok: false; reason: 'nao_encontrado' | 'limite_dia' | 'limite_conversa' | 'cota' | 'recusado' | 'incerto' }>` — reacha o cliente pelo e-mail, confere os três limites, grava ação `origin:'agente'`, `kind:'resend'`, `expected_email` = e-mail do cadastro, chama `execute`, grava `done`/`uncertain` com `log_id`. Bloqueio do índice `telegram_support_customer_lock` (ação incerta) vira `incerto`.

- [ ] **Step 1: Write the failing tests** — `it('não devolve sugestões nem pedidos')`; `it('recusa com limite_conversa no segundo reenvio em 24h')`; `it('recusa com cota quando restam 29')`; `it('recusa com limite_dia no 21º')`; `it('envia só ao e-mail do cadastro')` confere `expectedEmail` igual ao do cadastro; `it('ação incerta anterior vira incerto')`.
- [ ] **Step 2: Run** `npx vitest run tests/agent/purchase.test.ts tests/telegram` — Expected: FAIL só nos novos.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** — Expected: PASS, inclusive `tests/telegram`.
- [ ] **Step 5: Commit** `feat(agente): consulta e reenvio com limites do agente`.

### Task 5: Cérebro do agente (instruções e laço de ferramentas)

**Files:**
- Create: `src/lib/agent/prompt.ts`, `src/lib/agent/brain.ts`
- Test: `tests/agent/brain.test.ts`

**Interfaces:**
- Consumes: tipos das Tasks 2 a 4.
- Produces:
  - `buildSystemPrompt(input: { knowledge: { topic: string; rule: string }[]; platform: 'instagram'|'facebook'; today: string }): string` — voz da Marina; lista de anti-objetivos do spec; lista "Quando escalar" do spec; "use só preços e links do banco"; "o e-mail digitado serve só para localizar".
  - `type AgentTools = { buscar_compra(email: string): Promise<unknown>; reenviar_acesso(email: string): Promise<unknown>; escalar(motivo: string, resumo: string): Promise<unknown>; responder(texto: string): Promise<unknown> }`
  - `runAgent(input: { system: string; messages: { role: 'user'|'assistant'; text: string }[]; tools: AgentTools; callModel: CallModel; maxSteps?: number }): Promise<{ replied: boolean; escalated: boolean }>` — laço de tool use até `responder` ou `escalar`; no máximo 6 passos; `responder` só uma vez por execução; `reenviar_acesso` só depois de `buscar_compra` com `found:true` para o mesmo e-mail na mesma execução; fim sem `responder` nem `escalar` = chama `escalar('sem_resposta', …)`.
  - `CallModel` = função que chama a API da Anthropic (Messages, tool use). Implementação real em `brain.ts` com `fetch` e `AGENT_MODEL`; o padrão do modelo é escolhido carregando a skill `claude-api` (mais recente que caiba no custo) e registrado na estimativa de custo da Task 9.

- [ ] **Step 1: Write the failing tests** (com `callModel` falso que devolve chamadas de ferramenta roteirizadas) — `it('responde dúvida de preço com uma chamada a responder')`; `it('não reenvia sem buscar_compra encontrado antes')`; `it('segunda chamada a responder é ignorada')`; `it('passa de 6 passos e escala')`; `it('erro da API escala com motivo erro_modelo')`; `it('instruções contêm R$ 19,90 vindo do banco e a regra de não corrigir e-mail')`.
- [ ] **Step 2: Run** `npx vitest run tests/agent/brain.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(agente): instruções e laço de ferramentas`.

### Task 6: Ferramentas ligadas ao mundo real e escalação no Telegram

**Files:**
- Create: `src/lib/agent/tools.ts`, `src/lib/agent/escalation.ts`
- Test: `tests/agent/tools.test.ts`

**Interfaces:**
- Consumes: `ZernioClient` (Task 2), `AgentRepository` (Task 3), `findPurchase`/`resendAccess` (Task 4), `createTelegramClient` e `teamOwners()` (existentes).
- Produces:
  - `createAgentTools(ctx: { conversation: AgentConversation; zernio: ZernioClient; repo: AgentRepository; purchase: { findPurchase; resendAccess }; escalate: Escalate }): AgentTools`
  - `type Escalate = (input: { conversation: AgentConversation; reason: string; summary: string; recent: AgentMessage[] }) => Promise<void>` — `createEscalate(io, owners, repo)`: manda a cada proprietário mensagem HTML (plataforma, nome, últimas 6 mensagens escapadas com `html()` de `format.ts`, motivo, resumo, "Responda a esta mensagem para enviar ao cliente"); grava `agent_escalations` por mensagem; `setState('escalated')`.
  - `escalar` manda ao cliente, uma vez por conversa, a entrada do banco de tópico `escalacao` (seed: "Vou verificar com a equipe e te respondo aqui 💛") e chama `Escalate`.
  - `buscar_compra` com `found:false` pela segunda vez na mesma conversa devolve ao modelo `{ found:false, instrucao:'escalar' }` (Review Focus 5).

- [ ] **Step 1: Write the failing tests** — `it('responder envia pela Zernio e grava saída do agente')`; `it('escalar avisa só proprietários')`; `it('mensagem de escalação não traz e-mail do cadastro')`; `it('segundo e-mail não encontrado instrui escalar')` (Review Focus 5); `it('aviso ao cliente na escalação sai uma vez só')`.
- [ ] **Step 2: Run** `npx vitest run tests/agent/tools.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(agente): ferramentas e escalação no Telegram`.

### Task 7: Processamento de uma conversa

**Files:**
- Create: `src/lib/agent/process.ts`
- Modify: `src/app/api/webhooks/zernio/route.ts` (ligar `schedule` ao `processConversation` dentro de `after`)
- Test: `tests/agent/process.test.ts`

**Interfaces:**
- Consumes: tudo das Tasks 2 a 6.
- Produces: `processConversation(input: { conversationId: string; messageId: string }, deps: { repo; zernio; brain: typeof runAgent; callModel; buildTools; escalate; sleep(ms: number): Promise<void>; now(): Date; config: AgentConfig; storeId: string }): Promise<'respondido'|'escalado'|'ignorado'>`
- Ordem: espera `batchSeconds`; se a última mensagem recebida da conversa não é `messageId`, `ignorado` (outra execução responde, Review Focus 2). Agente desligado → escalar `agente_pausado`. Conversa `paused` dentro de `paused_until` → `ignorado`. Conversa `escalated` → reenvia a mensagem nova ao Telegram como continuação, sem responder (Review Focus 3). Última mensagem do cliente com mais de 24 h → escalar `fora_da_janela`. Última mensagem gravada já é do agente e não há mensagem nova do cliente → `ignorado`. Senão monta histórico (últimas 12) e roda o cérebro.

- [ ] **Step 1: Write the failing tests** — `it('três mensagens seguidas geram uma resposta')`; `it('conversa escalada não responde e avisa o Telegram')`; `it('conversa pausada pelo Allan é ignorada')`; `it('fora da janela escala sem responder')`; `it('agente desligado escala')`.
- [ ] **Step 2: Run** `npx vitest run tests/agent/process.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `npx vitest run tests/agent` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(agente): processamento da conversa`.

### Task 8: Resposta do Allan, aprendizado e comandos no Telegram

**Files:**
- Create: `src/lib/agent/telegram.ts`, `src/lib/agent/learn.ts`
- Modify: `src/app/api/webhooks/telegram/route.ts` (chamar `handleAgentTelegram` antes de `handleTelegramUpdate`, só se o usuário estiver em `teamOwners()`)
- Test: `tests/agent/telegram.test.ts`

**Interfaces:**
- Consumes: `telegramUpdateSchema` (existente), repositório, Zernio, `callModel`.
- Produces:
  - `handleAgentTelegram(update: z.infer<typeof telegramUpdateSchema>, deps: { owners: number[]; repo; zernio; io; learn: Learn; now(): Date; storeId: string }): Promise<boolean /* true = tratado */>`
  - Resposta (`reply_to_message`) a uma mensagem de escalação: envia o texto ao cliente; usa `humanAgent:true` se passaram mais de 24 h e menos de 7 dias da última mensagem do cliente; mais de 7 dias responde no Telegram "Passou de 7 dias, a Meta não deixa mais enviar por aqui." e não envia. Depois: `recordOutgoing(author:'allan')`, `answerEscalation`, `setState('active')`, `learn`.
  - `type Learn = (input: { reply: string; recent: AgentMessage[] }) => Promise<{ general: false } | { general: true; topic: string; rule: string }>` — classifica com o modelo; regra sem nome, e-mail ou dado pessoal. Se geral, `addKnowledge` e confirma no Telegram "Enviado. Aprendi: <regra>" com botão `agk:off:<uuid>` ("Não aprender isso"); se não, "Enviado. Não virou regra (caso pessoal)."
  - Callback `agk:off:<uuid>` → `deactivateKnowledge`. Comandos `/agente pausar`, `/agente ligar`, `/agente status` (só proprietários) → `setEnabled`/`isEnabled`.

- [ ] **Step 1: Write the failing tests** — `it('resposta do Allan vai ao cliente e reativa a conversa')`; `it('usa HUMAN_AGENT entre 24h e 7 dias')`; `it('recusa depois de 7 dias')`; `it('operador que não é dono não é tratado')`; `it('regra aprendida não contém o e-mail do cliente')`; `it('não aprender isso desativa a entrada')`; `it('/agente pausar desliga')`.
- [ ] **Step 2: Run** `npx vitest run tests/agent/telegram.test.ts tests/telegram` — Expected: FAIL só nos novos.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(agente): resposta do Allan e aprendizado`.

### Task 9: Resumo semanal, verificação final e colocação no ar

**Files:**
- Create: `src/lib/agent/digest.ts`, `src/app/api/cron/agent-digest/route.ts`, `docs/agente-suporte.md`
- Modify: `vercel.json` (cron `{ "path": "/api/cron/agent-digest", "schedule": "0 2 * * 1" }` = domingo 23h de Brasília), `src/lib/telegram/monitoring.ts` (linha "🤖 Reenvios do agente: <b>${m.agentResends}</b>" e campo `agentResends` em `DailyMetrics`)
- Test: `tests/agent/digest.test.ts`, `tests/telegram/monitoring.test.ts`

**Interfaces:**
- Consumes: repositório e `authorizeTelegramJob` (existente).
- Produces: `buildDigest(m: { conversas: number; resolvidas: number; reenvios: number; escalacoes: Record<string, number>; novas: { id: string; rule: string }[]; repetidas: string[] }): { text: string; buttons: Button[][] }` — cada entrada nova com botão `agk:off:<uuid>`.

- [ ] **Step 1: Write the failing tests** — `it('resumo lista escalações por motivo e entradas novas com botão')`; `it('relatório diário mostra reenvios do agente')`.
- [ ] **Step 2: Run** `npx vitest run tests/agent/digest.test.ts tests/telegram/monitoring.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** digest, rota (Bearer `CRON_SECRET`, só proprietários recebem) e `docs/agente-suporte.md` (variáveis, ativação, pausa, rollback).
- [ ] **Step 4: Run** `npm test` e `npm run lint` e `npx next build` — Expected: tudo verde.
- [ ] **Step 5: Estimar custo** mensal com o modelo escolhido (≈ conversas/dia reais do inbox × tokens medidos num teste) e mostrar ao Allan. Parar aqui até o ok dele.
- [ ] **Step 6: Commit** `feat(agente): resumo semanal e documentação` (com ok do Allan).
- [ ] **Step 7: Colocação no ar (cada item com ok do Allan):** aplicar a migração no Supabase `tujtwlrxpetpiatlbrps`; variáveis na Vercel; o Allan cria a chave da Zernio e a chave da Anthropic; publicar; registrar o webhook `POST /v1/webhooks/settings` com eventos `message.received` e `message.sent` e o segredo; teste com perfil pessoal do Allan (preço, "é físico?", "não recebi" com e-mail de conta interna, pedido de reembolso → Telegram); desligar `also_match_in_dms` nas automações `6b05a91aec76f70f9f9cac3f` e `6b05ad8a027a3ed5fc2a0bd5`; `/agente ligar`.
