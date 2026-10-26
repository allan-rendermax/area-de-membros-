# Bot de suporte Telegram — visual e menos mensagens redundantes

Pedido do proprietário em 26/10/2026: o bot funciona bem; melhorar o visual (emojis, negrito, cores) e cortar processos redundantes. **Sem mudança de banco, regras de acesso ou segurança.** Toda proteção atual continua: confirmação antes de enviar/corrigir, travas, revalidação no `execute`, replay, expiração de 30 min, lista de operadores, proteção do proprietário.

Branch: `codex/telegram-visual` (a partir de `a7d1b24`, igual a `origin/main`). Não fazer commit, build nem chamadas de rede; quem orquestra faz isso.

## Decisões já tomadas

- **Formatação:** todas as mensagens passam a usar `parse_mode: 'HTML'`. Todo valor dinâmico (nome, e-mail, loja, nome de membro da equipe, texto de resultado vindo de `operations.ts`, status de entrega) passa por `escapeHtml` (`&`, `<`, `>`). Nunca cortar HTML pronto com `slice`: limitar listas/valores **antes** de montar o HTML, mantendo a mensagem abaixo de 4096 caracteres.
- **Cores nos botões:** Bot API 9.4 adicionou `style` em `InlineKeyboardButton`: `'success'` (verde), `'danger'` (vermelho), `'primary'` (azul). Campo opcional; apps antigos ignoram. Acrescentar `style?: 'success' | 'danger' | 'primary'` ao tipo `Button`.
- **Editar no lugar em vez de mandar mensagem nova:** novo método `io.edit(chatId, messageId, text, buttons?)` com `editMessageText` (HTML, `link_preview_options` desligado, `reply_markup` com os botões ou vazio). Se o Telegram responder erro cuja `description` contém `message is not modified`, tratar como sucesso. Qualquer outra falha de edição: cair para `send` (nova mensagem). O erro continua sanitizado (sem token, sem corpo bruto).
- **Ações criadas só no clique:** hoje cada ficha de cliente (inclusive cada "Atualizar") grava 2 linhas em `telegram_support_actions`, usadas ou não. Passa a ser: botões da ficha carregam `resend:<customerId>` e `correct:<customerId>`; no clique o bot relê o cliente (novo método leve em `ops`, sem consultar Resend: cadastro + produtos liberados), recusa se não existe, está bloqueado ou sem produto, e só então cria a ação com o e-mail atual — `resend` nasce em `confirm`, `correct` nasce em `awaiting_email`. O passo `open:` deixa de existir (botões `open:` antigos caem em "Botão indisponível ou expirado"). `confirm:<actionId>` e `cancel:<actionId>` continuam iguais. O estado `ready` permanece no tipo/banco por compatibilidade, só não é mais criado.
- **Relatório diário sem buraco:** hoje às 23h cobre 00h–23h e as vendas de 23h00–23h59 nunca entram em relatório. Manter o envio às 23h de Brasília e passar a cobrir **23h do dia anterior → 23h do dia** (24h corridas). Cabeçalho: `🗓️ 25/10 23h → 26/10 23h (Brasília)`. `report_date` continua sendo o dia do envio.

## Fluxos (qual clique edita, qual manda mensagem nova)

| Clique / comando | Comportamento |
|---|---|
| E-mails digitados | 1 mensagem nova por e-mail (ficha ou "não encontrado") |
| `view:<id>` (abrir cliente a partir da lista de falhas ou das sugestões) | mensagem nova (mantém a lista) |
| `refresh:<id>` (🔄 Atualizar, 👤 Voltar ao cliente, 👤 Ver cliente atualizado) | edita a própria mensagem com a ficha atual |
| 📨 Reenviar acesso | cria ação e **edita a ficha** virando a confirmação |
| ✏️ Corrigir e-mail | cria ação e manda o pedido de resposta (`force_reply` exige mensagem nova) |
| Resposta com novo e-mail | mensagem nova com `antigo → novo` + confirmação |
| ✅ Confirmar | edita a confirmação para `⏳ Enviando…` (sem botões, best effort), executa, edita com o resultado + `👤 Ver cliente atualizado` (`refresh:`) |
| ✖️ Cancelar | edita para `✖️ Cancelado. Nada foi enviado.` + `👤 Voltar ao cliente` |
| Menu `⚠️ Clientes com falha` e `/falhas` | mensagem nova (`failures:0`) |
| ◀️ Anterior / Próxima ▶️ / 🔄 Atualizar lista nas falhas | edita a lista (`failpage:<offset>`) |
| `/equipe`, `👥 Gerenciar equipe` | mensagem nova |
| Paginação da equipe, confirmar/cancelar alteração de equipe | edita a mensagem |

O `callback_query.message.message_id` precisa chegar a `onCallback` e a `handleTeamUpdate` para editar. `callback_data` continua ≤ 64 bytes.

## Textos (modelo; manter o sentido e os avisos atuais)

Ficha do cliente:

```
👤 <b>Natan Silva</b>
✉️ <code>natan@gmail.com</code>
🏪 Arquitetura

🟢 <b>Acesso liberado</b>            (🔴 Cliente bloqueado · ⚪ Nenhum produto liberado)
📚 Atlas Visual das Patologias — Completo

🧾 <b>Compras</b>
✅ Pago · <code>TX123</code>
↩️ Reembolsado · <code>TX456</code>  (⏳ Pendente · ❌ Cancelado · ⚠️ Chargeback · outro: • status)

📬 <b>Último aviso de acesso</b>
<texto de entrega com emoji do evento>
```

Emoji por evento de entrega (prefixo do `deliveryLabel`): delivered 📬, opened 👀, clicked 🔗, sent 📤, bounced 🔴, suppressed ⛔, complained 🚫, failed ❌, delivery_delayed/delayed ⏳, queued/scheduled 🕒, desconhecido ❔.

Botões da ficha: `[📨 Reenviar acesso (primary)] [✏️ Corrigir e-mail]`, `[🔄 Atualizar]`, `[⚠️ Clientes com falha]`. Sem ação possível (bloqueado/sem produto): só Atualizar e menu.

Confirmações: `📨 <b>Reenviar acesso?</b>\nPara: <code>x</code>` com `[✅ Confirmar envio (success)] [✖️ Cancelar]`. Correção: `✏️ <b>Corrigir e-mail</b>\n<code>antigo</code>\n⬇️\n<code>novo</code>\n\n<aviso atual sobre todas as lojas>` com `[✅ Confirmar correção e envio (success)] [✖️ Cancelar]`.

Resultado: prefixo `✅` para `done` com envio aceito, `⛔` para recusa (done sem envio), `⚠️` para `uncertain`. Ajustar sem mudar a lógica de `operations.ts` (pode devolver um campo extra ou o handler decidir pelo `logId`/`state`).

Boas-vindas (`/start`, `/help`, texto sem e-mail) — **um único construtor** usado por `handler.ts` e `team.ts` (hoje são dois textos diferentes):

```
👋 <b>Suporte ElevaMAX</b>

Envie até <b>5 e-mails</b> numa mensagem para ver compras, produtos liberados e o último aviso de acesso.

Em cada cliente: 📨 reenviar acesso ou ✏️ corrigir e-mail. Nada é enviado sem a sua confirmação.

Atalhos: /falhas · /id        (proprietário: + /equipe)
```

Menu do proprietário ganha `[👥 Gerenciar equipe]`.

Lista de falhas: título `⚠️ <b>Falhas de e-mail — últimos 30 dias</b>`, linha com total, `🕐 Última conferência: …`, itens `1. <code>email</code>\n   🔴 Devolvido · dd/mm hh:mm` (⛔ Bloqueado pelo provedor, ❌ Falha de envio) e `↳ enviado para <code>outro</code>` quando diferente. Botões `👤 email` (view), navegação `◀️ Anterior`/`Próxima ▶️`, `🔄 Atualizar lista`.

Relatório diário em blocos: `📊 <b>Resumo diário — Loja</b>`, `🗓️ janela`, `💰 Vendas`, `📧 Avisos de acesso` (📬 entregues, ❌ falhas, ⏳ aguardando, 🚫 spam, ❔ sem classificação), `🛠️ Suporte pelo bot` (📨 reenvios, ✏️ correções, ⛔ sem envio, ⚠️ incertas), `⚠️ Pendências (30 dias)`, `🕐 Última conferência`, nota final em `<i>`. Números em `<b>`.

Equipe: `👥 <b>Equipe de suporte</b>`, `[➕ Adicionar membro (primary)]`, `[🗑️ Remover Nome (danger)]`, confirmação de liberação `[✅ Confirmar liberação (success)]`, de remoção `[🗑️ Confirmar remoção (danger)]`, `[✖️ Cancelar]`, `[◀️ Voltar à equipe]`. `/id`: `🆔 Seu ID do Telegram: <code>123</code>` (+ instrução atual para não autorizados).

Mensagens de erro/aviso ganham ⚠️ ou ⛔; manter o conteúdo.

## Perfil do bot (script)

`scripts/telegram-support.mjs`: novo modo `profile` (e chamado também dentro de `activate`) que aplica:
- `setMyCommands`: start "👋 Início e ajuda", falhas "⚠️ Clientes com falha de e-mail", equipe "👥 Gerenciar equipe (proprietário)", id "🆔 Ver meu ID do Telegram".
- `setMyShortDescription` (≤120): `Suporte ElevaMAX: consulte compras, reenvie acessos e corrija e-mails de clientes. Uso restrito à equipe.`
- `setMyDescription` (≤512): `🔒 Bot privado da equipe de suporte ElevaMAX.\n\nEnvie o e-mail do cliente para ver compras, produtos liberados e o último aviso de acesso. Reenvio e correção só acontecem depois da sua confirmação.\n\nNão é da equipe? Envie /id e passe o número ao responsável.`
- Opcional `--photo <arquivo.jpg>`: `setMyProfilePhoto` (Bot API 9.4) com multipart, `photo` = `{"type":"static","photo":"attach://photo"}`. Sem o argumento, não mexe na foto.

## Limpeza de redundância no código

- `open:` e a criação antecipada de ações saem (acima).
- Texto de ajuda duplicado vira um construtor só.
- Funções de formatação (escape, emoji de status/evento, botões padrão) num módulo novo `src/lib/telegram/format.ts`; `monitoring.ts`, `team.ts` e `handler.ts` usam dele.

## Testes e documentação

- Atualizar os testes de `tests/telegram/*` ao novo fluxo e textos; o mock de `io` ganha `edit`.
- Novos casos: escape de nome com `<b>&`; ficha não cria ação; clique em reenviar cria 1 ação e edita a mensagem; cliente bloqueado no clique não cria ação; `message is not modified` vira sucesso; outra falha de edição cai para `send`; botão `open:` antigo responde expirado; estilos `success`/`danger`/`primary` presentes; janela do relatório 23h→23h (inclusive virada de mês); boas-vindas iguais em handler e team, com `/equipe` só para proprietário.
- Manter os testes de segurança existentes passando (replay, clique simultâneo, destinatário alterado, desconhecido, grupos, expiração).
- Atualizar `docs/telegram-suporte.md` (fluxo novo, modo `profile`, janela do relatório).
- Rodar: `npm test -- tests/telegram --maxWorkers=2`, `npx tsc --noEmit`, `npx eslint src/lib/telegram src/app/api/webhooks/telegram src/app/api/cron tests/telegram scripts/telegram-support.mjs`. Reportar a saída final.
