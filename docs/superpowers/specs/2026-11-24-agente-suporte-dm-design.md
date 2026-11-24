# Agente de suporte no direct da Marina Costa: design

Data: 24/11/2026. Status: rascunho para aprovação do Allan.

## Intenção

O Allan quer um agente que atenda sozinho, 24 horas, o direct do Instagram (@arq.marinacostaa) e o Messenger da Página do Facebook "Arq Marina Costa". O agente fala na voz da Marina Costa (arquiteta, rosto da linha Atlas desde 24/11/2026) e melhora com o uso: cada caso que o Allan resolve vira conhecimento novo.

Por quê: hoje as mensagens ficam dias sem resposta e são perdidas vendas e clientes. Exemplos reais de 24/11: "Valor" sem resposta desde segunda, "Eu comprei e não recebi o material" sem resposta por 6 dias, gente de Moçambique e Cabo Verde recebendo o link do Brasil. O suporte que mais aparece ("não recebi", "não enviam") já tem solução pronta nesta plataforma (bot do Telegram), mas depende do Allan abrir o Telegram e consultar.

## Decisões do Allan

- Autonomia total desde o início: o agente envia as respostas sem aprovação prévia (decidido em 24/11/2026).
- Construir dentro desta área de membros, reaproveitando o suporte do Telegram (opção 1, decidido em 24/11/2026).
- Tom: vendedor, caloroso, com alguns emojis (aprovado nas respostas manuais de 24/11/2026).
- Respostas sobre o Atlas de Patologias: Básico R$ 19,90, Completo R$ 36,90; Brasil em `https://patologias.casadoconhecimento.online/`, fora do Brasil em `/internacional` (pagamento internacional pela Hotmart).

## Objetivos

1. Responder todo direct novo das duas contas em minutos, dentro da janela de 24 horas da Meta.
2. Resolver sozinho as dúvidas de venda: preço, o que é, se é físico ou digital, como comprar, link certo para Brasil ou exterior.
3. Resolver sozinho o "não recebi" de compras Payt da loja `arquitetura`: pedir o e-mail, localizar a compra, reenviar o acesso para o e-mail já cadastrado e confirmar ao cliente.
4. Passar ao Allan pelo Telegram o que não pode resolver, e devolver ao cliente a resposta que o Allan der.
5. Aprender: a resposta do Allan num caso escalado vira entrada nova no banco de respostas, usada dali em diante. Resumo semanal do que foi aprendido.

## Fora do escopo (fase 1)

- Comentários públicos. Continuam com as 4 automações da Zernio (VENDA e SUPORTE no Instagram e no Facebook). Quando a pessoa responde o direct que a automação mandou, a conversa cai no agente.
- WhatsApp, e-mail, outras contas e outras lojas.
- Compras da Hotmart (não estão nesta base). O agente orienta e escala.
- Criar pedido, liberar produto não comprado, reembolsar, dar cupom ou desconto.

## O que não pode acontecer (anti-objetivos)

- Inventar preço, link, prazo, bônus, depoimento, garantia ou política. Só o que está no banco de respostas.
- Prometer reembolso ou discutir com o cliente.
- Mandar acesso para um e-mail diferente do cadastrado. O e-mail que a pessoa digita no direct serve só para localizar o cadastro. Corrigir e-mail de cadastro pelo direct é proibido (risco de alguém tomar a conta de outro): esse caso é escalado.
- Revelar dados de outro cliente (se o e-mail não bate, não dizer de quem é nem sugerir parecidos).
- Responder em loop: duas respostas do agente seguidas sem mensagem nova do cliente, ou responder a mensagens enviadas pela própria conta.
- Responder à mesma mensagem duas vezes (o webhook pode repetir).

## Restrições conhecidas

- Meta: resposta livre só até 24 horas depois da última mensagem do cliente. Passou disso, o agente não responde e o caso vai para o Telegram como "fora da janela".
- Zernio: avisa cada direct novo pelo webhook `message.received` (traz `conversationId`, `platform`, texto, remetente e conta). Resposta por `POST /v1/inbox/conversations/{conversationId}/messages` com `accountId` e `message`. Contas: Instagram `6b05a6a49f8d271e5d1941a2`, Facebook `6b05a8f01de1f94249e842e8`, profile `6b05a5204fe9008df9411d74`. Precisa de chave de API própria do agente (criar em zernio.com/dashboard/api-keys) e da assinatura do webhook conferida.
- Conflito com a automação SUPORTE da Zernio: ela também dispara em direct ("não recebi" etc., `also_match_in_dms`). Ao ligar o agente, desligar essa opção nas duas SUPORTE (IDs `6b05a91aec76f70f9f9cac3f` e `6b05ad8a027a3ed5fc2a0bd5`), senão o cliente recebe duas respostas.
- Reaproveitar do suporte do Telegram (ver `docs/telegram-suporte.md`): consulta de cliente, pedidos e entrega (`createSupportOperations`, `lookup`), reenvio (`execute` com `kind: 'resend'`, que já confere bloqueio, conta administrativa, divergência de login, produtos liberados e cota diária) e o envio de mensagens ao Telegram. O agente não usa a ação `correct`.
- Primeiro uso de IA nesta base: chave da API da Anthropic como variável de ambiente na Vercel, nunca no código.
- Next.js desta base tem mudanças em relação ao conhecido: ler `node_modules/next/dist/docs/` antes de escrever rota ou trabalho em segundo plano (AGENTS.md).
- Dados de cliente não vão para log de aplicação (regra já seguida pelo bot do Telegram).
- Produção é a branch `main`, publicada na Vercel. A pasta principal está em outra branch com trabalho não salvo: trabalhar só neste worktree.

## Caminhos considerados

| Caminho | A favor | Contra | Decisão |
|---|---|---|---|
| 1. Dentro da área de membros, junto do bot do Telegram | Reaproveita consulta, reenvio, travas de segurança e Telegram já testados | Mexe no sistema em produção | Escolhido pelo Allan |
| 2. Função separada no Supabase | Isolado da área de membros | Refazer reenvio e Telegram, duas versões da mesma regra | Descartado |
| 3. Robô pronto da Zernio (OpenClaw, Hermes etc.) | Quase sem código | Não aprende, não confere compra, não usa o Telegram, dependência de terceiro | Descartado |

## Como funciona

### Fluxo de uma mensagem

1. Zernio chama `POST /api/webhooks/zernio`. A rota confere a assinatura, aceita só `message.received` das duas contas, só mensagens recebidas (não as enviadas pela conta), grava o evento com o ID da mensagem como chave única (repetição é ignorada) e responde rápido.
2. O processamento roda em segundo plano. Se o cliente mandou várias mensagens seguidas, o agente espera alguns segundos e responde tudo de uma vez.
3. Monta o contexto: últimas mensagens da conversa (Zernio ou registro local), plataforma, nome, e se a conversa já foi escalada.
4. Chama o modelo com: instruções fixas (voz da Marina, limites acima), o banco de respostas ativo, e as ferramentas:
   - `buscar_compra(email)`: usa a consulta do bot do Telegram na loja `arquitetura`. Devolve para o modelo só o necessário: achou ou não, produtos liberados, situação do último aviso de acesso. Nunca devolve sugestões de e-mails parecidos.
   - `reenviar_acesso(email)`: só se a compra foi achada; usa `execute` com `kind: 'resend'` e o e-mail cadastrado. Registra a ação como as do Telegram.
   - `escalar(motivo, resumo)`: avisa o Allan no Telegram e marca a conversa.
   - `responder(texto)`: envia pela Zernio. É a única forma de falar com o cliente.
5. Grava tudo: mensagem, resposta, ferramentas usadas, escalação.

### Quando escalar (sempre, mesmo com autonomia total)

- Pedido de reembolso, cancelamento, ameaça (Procon, processo, "vou denunciar"), xingamento.
- "Não recebi" sem compra encontrada depois de pedir o e-mail uma vez, ou compra pela Hotmart.
- Pedido de troca de e-mail do cadastro.
- Reenvio recusado pelas travas (bloqueio, divergência, cota, sem produto) ou resultado incerto.
- Pergunta que o banco de respostas não cobre (parceria, imprensa, dúvida técnica fora do material).
- Cliente que reclama da resposta do agente, ou terceira mensagem sem solução na mesma conversa.
- Fora da janela de 24 horas.

Ao escalar, o agente diz ao cliente algo como "vou verificar com a equipe e te respondo aqui" (texto do banco de respostas), uma única vez.

### Resposta do Allan e aprendizado

- A mensagem no Telegram mostra: plataforma, nome, últimas mensagens, motivo, e o que o agente já fez.
- O Allan responde à mensagem no Telegram (resposta direta). O bot envia o texto ao cliente pela Zernio como a Marina, com confirmação de envio.
- O texto do Allan vira entrada nova do banco: o modelo reescreve como regra geral, sem nome, e-mail ou dado pessoal, e grava como ativa com origem "Allan" e o caso de origem. Botão "Não aprender isso" na confirmação desfaz.
- Respostas pessoais ("liberei pra você agora") não viram regra: o modelo classifica antes de gravar.
- Domingo à noite, resumo no Telegram: conversas atendidas, resolvidas sozinho, reenvios feitos, escalações por motivo, entradas novas (com botão para desativar cada uma) e perguntas repetidas que ainda escalam.

### Banco de respostas

Tabela nova no Supabase, privada (RLS, só backend), por loja: tema, quando usar, resposta ou regra, origem (inicial ou Allan), ativa, criada em, vezes usada. Não existe aprendizado sem passar pelo Allan. Começa com o conteúdo aprovado em 24/11/2026 e conferido nas páginas no mesmo dia:

| Atlas | Página Brasil | Básico | Completo | 3º plano |
|---|---|---|---|---|
| Patologias | `https://patologias.casadoconhecimento.online/` | R$ 19,90 | R$ 36,90 (3 bônus) | Arq Black R$ 97 |
| Paisagismo Tropical | `https://paisagismo.casadoconhecimento.online/` | R$ 19,90 | R$ 36,90 (3 bônus) | Arq Black R$ 97 |
| Arquitetura Hospitalar | `https://hospitalar.casadoconhecimento.online/` | R$ 19,90 | R$ 36,90 (3 bônus) | Arq Black R$ 97 |

Fora do Brasil só existe página para Patologias (`/internacional`, Hotmart, dólar). Para os outros dois, quem está fora do Brasil é escalado. As compras Payt dos três estão na loja `arquitetura` desta base (conferido em 24/11/2026: Patologias, Paisagismo e Hospitalar com pedidos), então o "não recebi" de qualquer um deles é resolvido pelo agente.

Também entram: "é digital, chega no e-mail, olhe o spam", área de membros `https://members.grupoelevamax.com/arquitetura/entrar`, quem é a Marina, crítica técnica ("leitura visual não substitui profissional habilitado"). Preço muda: quando o Allan mudar preço numa página, o banco precisa ser atualizado junto (comando no Telegram ou edição direta).

## Decisões de quem escreveu este design (o Allan pode mudar)

1. **Conversa escalada:** o agente fica calado nela até o Allan responder pelo Telegram. Se o Allan responder direto pelo app do Instagram ou do Messenger (mensagem enviada pela conta que não saiu do agente), o agente sai daquela conversa por 24 horas. Depois da resposta do Allan pelo Telegram, o agente volta a atender na próxima mensagem nova do cliente.
2. **Fora da janela de 24 horas:** o agente nunca responde. Para as respostas do Allan pelo Telegram, quem constrói confere se a Zernio aceita a etiqueta de atendimento humano da Meta (até 7 dias). Se aceitar, ela é usada só nas respostas do Allan. Se não, o Telegram avisa "não dá mais para enviar por aqui".
3. **Quem recebe e ensina:** só os proprietários (`TELEGRAM_OWNER_USER_IDS`). Operadores da equipe não recebem escalações nem ensinam o agente. Hoje só existe o proprietário.
4. **Cota de e-mail:** o agente faz no máximo 20 reenvios por dia e 1 por conversa a cada 24 horas, e para quando restarem menos de 30 envios na cota diária da plataforma (`EMAIL_DAILY_LIMIT`), para não tirar e-mail de acesso de quem acabou de comprar. Passou disso, escala.
5. **Registro dos reenvios:** as ações do agente ficam em `telegram_support_actions` com origem "agente" (migração nova: usuário e chat do Telegram passam a ser opcionais e entra a coluna de origem). O relatório das 23h mostra "reenvios do agente" separado dos reenvios humanos. A trava de resultado incerto vale igual: cliente com ação incerta não recebe novo reenvio automático, o caso é escalado.

### Desligar rápido

Interruptor por variável de ambiente e comando no Telegram (`/agente pausar` e `/agente ligar`, só proprietário). Pausado, o webhook continua gravando e cada mensagem nova vai para o Telegram.

## Colocação no ar

1. Testes automáticos com Zernio, modelo e Telegram simulados (nenhuma mensagem real a cliente).
2. Teste real com conta interna: o Allan manda direct de um perfil pessoal para a Marina e confere as respostas, incluindo um "não recebi" com o e-mail de uma conta de teste.
3. Desligar `also_match_in_dms` nas duas automações SUPORTE da Zernio e ligar o agente.
4. Acompanhar o primeiro dia pelo resumo e pelos registros.

## Deixado para quem constrói

- Modelo e versão (consultar a referência da API da Anthropic; preferir o mais recente que caiba no custo), com estimativa de custo mensal mostrada ao Allan antes de ligar.
- Formato exato das tabelas, nomes de rota e arquivos, forma de rodar em segundo plano na Vercel, tempo de espera para juntar mensagens.
- Se o histórico da conversa vem da Zernio ou de registro próprio.
- Texto das instruções fixas, desde que siga a voz e os limites acima.
