# Agente de suporte no direct

O agente atende mensagens do Instagram e do Facebook das contas configuradas para uma loja. Responde em pt-BR, com a voz da Marina, usando o banco de respostas para preços, links e informações dos produtos. Dúvidas sem resposta segura, pedidos de reembolso e casos que precisam de uma pessoa vão para os proprietários no Telegram.

O agente só responde dentro de 24 horas da última mensagem do cliente. Respostas digitadas pelo proprietário podem usar a janela humana de até 7 dias. Quando o proprietário atende pelo direct, a conversa fica pausada para evitar respostas sobrepostas.

O agente começa pausado. Antes de `/agente ligar`, as mensagens recebidas são gravadas e encaminhadas ao Telegram, sem prender a conversa em `escalated`. Ao ligar, a próxima mensagem do cliente pode ser atendida automaticamente; uma pausa de atendimento pelo app continua valendo até expirar ou até a resposta pelo Telegram.

O reenvio de acesso usa apenas o e-mail já cadastrado, sem corrigir ou sugerir endereços parecidos. O agente pode fazer até 20 reenvios por dia, no máximo um por conversa a cada 24 horas, interrompendo os reenvios quando restarem menos de 30 envios na cota diária da plataforma.

## Variáveis

Configure estas variáveis no servidor, sem colocar chaves em arquivos públicos:

| Variável | Para que serve |
| --- | --- |
| `ZERNIO_API_KEY` | Chave para receber e enviar mensagens pela Zernio. |
| `ZERNIO_WEBHOOK_SECRET` | Segredo com pelo menos 32 caracteres para autenticar os eventos. |
| `ANTHROPIC_API_KEY` | Chave do modelo de respostas e aprendizado. |
| `AGENT_MODEL` | Modelo usado pelo agente. |
| `AGENT_ACCOUNT_IDS` | IDs das contas atendidas, separados por vírgula. |
| `AGENT_STORE_SLUG` | Identificador da loja atendida. |
| `AGENT_BATCH_SECONDS` | Tempo de agrupamento de mensagens antes de processar a conversa. |

O bot de Telegram já deve estar configurado. `TELEGRAM_OWNER_USER_IDS` define os proprietários que recebem escalações e o resumo semanal; operadores de suporte não recebem esses avisos. O cron usa `CRON_SECRET` com autenticação Bearer pelo autorizador de jobs existente.

Configure também um limite de gasto para a chave da Anthropic, usando os controles de orçamento disponíveis na conta ou workspace da chave. O processamento permite até 10 execuções por conversa na última hora e 400 por loja no dia de São Paulo; ao atingir o teto, encaminha ao Telegram sem chamar o modelo. Avisos de continuação, pausa pelo app e limites compartilham um intervalo mínimo de 10 minutos por conversa. Esses tetos não substituem o limite de gasto da Anthropic, pois o consumo também depende do tamanho das chamadas e do aprendizado.

## Ativação

Esta é a sequência para uma futura publicação. Cada etapa depende do ok do Allan; este documento não executa nenhuma delas. O agente começa desligado no banco.

1. Aplicar a migração `supabase/migrations/20261124010000_support_agent.sql` no projeto Supabase indicado no plano.
2. Preparar as variáveis na Vercel.
3. O Allan cria as chaves da Zernio e da Anthropic e preenche as variáveis correspondentes.
4. Publicar a versão verificada.
5. Registrar o webhook na Zernio por `POST /v1/webhooks/settings`, apontando para `/api/webhooks/zernio`, com os eventos `message.received` e `message.sent` e o segredo configurado.
6. Testar com o perfil pessoal do Allan: preço, “é físico?”, “não recebi” com e-mail de conta interna e pedido de reembolso encaminhado ao Telegram. Como o agente começa desligado, a rodada de respostas automáticas exige habilitação temporária autorizada; pausar novamente ao terminar esse teste.
7. Desligar `also_match_in_dms` nas automações SUPORTE `6b05a91aec76f70f9f9cac3f` e `6b05ad8a027a3ed5fc2a0bd5`.
8. Enviar `/agente ligar` no Telegram para iniciar a operação.

## Comandos e aprendizado

Somente os proprietários podem usar os comandos do agente:

- `/agente pausar`: interrompe respostas automáticas; mensagens novas são encaminhadas para atendimento no Telegram.
- `/agente ligar`: habilita o atendimento automático.
- `/agente status`: informa se o agente está ligado ou pausado.

Para responder um caso escalado, responda à própria mensagem no Telegram. A resposta é enviada ao cliente. Quando ela contém uma orientação geral, o agente pode salvar uma regra e mostrar “Aprendi” com o botão **Não aprender isso**. Esse botão desativa a regra salva; ele não desfaz a resposta já enviada ao cliente.

O resumo semanal chega aos proprietários no domingo às 23h de Brasília, pelo cron `0 2 * * 1` em UTC. Mostra os últimos sete dias: conversas com mensagem do cliente, conversas com resposta do agente e sem escalação no período, reenvios concluídos, escalações por motivo e motivos repetidos pelo menos três vezes. Mensagens aos diferentes donos da mesma escalação no mesmo minuto contam uma vez.

Em “Aprendi esta semana”, aparecem até dez regras novas ainda ativas, com botões **Desativar 1**, **Desativar 2** e assim por diante. Textos extensos são abreviados para caber na mensagem. O relatório diário também mostra os reenvios do agente em uma linha própria.

## Como desligar de vez

1. Enviar `/agente pausar` e conferir com `/agente status`.
2. Remover o webhook do agente na Zernio para parar a entrada de eventos.
3. Religar `also_match_in_dms` nas automações SUPORTE `6b05a91aec76f70f9f9cac3f` e `6b05ad8a027a3ed5fc2a0bd5`.

As conversas e regras continuam guardadas para conferência. Não é necessário apagar dados ou desfazer cadastros e acessos da área de membros.
