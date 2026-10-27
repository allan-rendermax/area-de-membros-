# Suporte ElevaMAX no Telegram

Bot: [@suporteelevamaxbot](https://t.me/suporteelevamaxbot). Implementação sem serviço de IA e sem computador local ligado. A ativação depende do token do BotFather, ID permitido, migração e publicação do endpoint.

## Operação pelo celular

- Envie até cinco e-mails em uma mensagem: o bot confere pedidos recebidos pela plataforma, plano efetivo, bloqueio e último aviso de acesso no Resend. Não consulta o painel Payt ao vivo nem inventa compra ausente.
- Sem cadastro exato, mostra até cinco endereços com prefixo semelhante para seleção manual. Não corrige automaticamente domínios ou nomes.
- **📨 Reenviar acesso** relê o cadastro e os produtos liberados, cria a ação com o e-mail atual e edita a ficha para mostrar o destinatário e exigir **✅ Confirmar envio**. Consultar e atualizar fichas não cria ações.
- **✏️ Corrigir e-mail** também relê o cadastro antes de criar a ação e envia um novo pedido de resposta. Responda diretamente com um endereço. Uma nova mensagem mostra anterior → novo e pede **✅ Confirmar correção e envio**.
- A correção afeta o cadastro/login e as compras em todas as lojas, como no admin. O reenvio pertence somente à loja configurada.
- **🔄 Atualizar**, **👤 Voltar ao cliente** e **👤 Ver cliente atualizado** atualizam a própria mensagem com a ficha. Abrir um cliente pelas sugestões ou falhas envia uma nova ficha, preservando a lista. Confirmar edita a mensagem para “⏳ Enviando…” e depois para o resultado; cancelar edita para “✖️ Cancelado. Nada foi enviado.”. “Aceito pelo provedor” não comprova entrega; “entregue” é confirmação do servidor do destinatário.
- Mensagens usam HTML com valores dinâmicos escapados, emojis e botões com estilos azul (ação principal), verde (confirmar) e vermelho (remover membro). Aplicativos antigos podem ignorar as cores. Listas e valores são limitados antes de montar HTML para caber no Telegram. Edição sem mudança é sucesso; outra falha de edição tenta enviar uma nova mensagem.

Confirmações e pedidos de correção expiram em 30 minutos e só funcionam para o operador e chat privado de origem. Os botões da ficha carregam apenas o ID do cliente; cada clique prepara uma ação nova após reler cadastro e produtos. Botões antigos `open:` passam a informar que estão indisponíveis ou expirados. O estado legado `ready` permanece compatível com o banco, mas não é mais criado. Acesso bloqueado, ausência de produtos, conta administrativa, mudança de destinatário e conflito com outro login impedem a ação. Um clique repetido não dispara novamente. Os testes não mandam mensagens a clientes.

## Ativação

1. Crie o bot em @BotFather, `/newbot`, com usuário `suporteelevamaxbot`. Use o token em `.env.telegram.local`, arquivo privado ignorado pelo Git. Nunca coloque token em código, argumentos de terminal ou documentação.
2. Configure no arquivo privado:

```dotenv
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=suporteelevamaxbot
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_ADMIN_USER_IDS=
TELEGRAM_SUPPORT_STORE_SLUG=arquitetura
TELEGRAM_PUBLIC_BASE_URL=https://members.grupoelevamax.com
```

O segredo deve ter 32–256 caracteres de letras, números, `_` ou `-`. Gere com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` e guarde somente no arquivo privado.

3. Execute `node scripts/telegram-support.mjs info`. Abra o bot e pressione **Iniciar**. Execute `node scripts/telegram-support.mjs users`, confirme seu usuário e preencha o ID numérico em `TELEGRAM_ADMIN_USER_IDS`. Nenhum primeiro usuário é autorizado automaticamente.
4. Aplique `supabase/migrations/20261025010000_telegram_support.sql` no mesmo projeto Supabase usado pela produção. Tabelas privadas com RLS e privilégios somente para `service_role`.
5. Publique somente o código do bot e o pequeno ajuste de precondição em `changeCustomerEmail(id,newEmail,expectedEmail?)` sobre a versão atual da plataforma. Não publique um checkout antigo sobre produção. Configure na hospedagem `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ADMIN_USER_IDS` e `TELEGRAM_SUPPORT_STORE_SLUG`. `APP_URL` deve ser a origem HTTPS pública; reaproveitar credenciais e remetente da plataforma. `.env.telegram.local` serve ao script, não é carregado automaticamente pelo Next.js.
6. Execute `node scripts/telegram-support.mjs activate`. O script verifica o bot, endpoint e tabelas antes de registrar o webhook. Não remove webhook existente ou descarta updates. Não imprime token.
7. No Telegram, consulte um cliente conhecido e confira o resultado. Teste o reenvio somente para conta interna autorizada. Configure webhook com uma conexão para respeitar a consulta serial ao provedor.

## Perfil do bot

`node scripts/telegram-support.mjs profile` atualiza comandos, descrição curta e descrição completa, depois de conferir a identidade do bot. O modo `activate` aplica o mesmo perfil após as verificações de ativação. `/help` continua funcionando; os comandos exibidos são `/start`, `/falhas`, `/equipe` e `/id`.

Para trocar a foto, use `node scripts/telegram-support.mjs profile --photo <arquivo.jpg>` (ou `activate --photo <arquivo.jpg>`). O envio usa `setMyProfilePhoto` com multipart e foto estática. Sem `--photo`, a foto atual é preservada. Esses comandos fazem chamadas de rede e devem ser executados apenas na operação de ativação/atualização; os testes usam I/O simulado.

Esta atualização visual não exige migração nova nem muda regras de acesso ou segurança.

## Lista de falhas e relatório diário

O botão **Clientes com falha de e-mail** aparece em `/start`, `/help` e consultas. `/falhas` abre a mesma lista, em páginas de dez clientes. Paginar ou atualizar edita a própria lista; abrir pelo menu ou `/falhas` envia uma nova mensagem. Ela considera avisos de acesso dos últimos 30 dias com devolução, supressão ou falha de envio, exclui convites do WhatsApp e retira clientes com entrega posterior confirmada, inclusive após correção de endereço. Mostra a última conferência completa e os registros ainda sem status. Abrir um cliente oferece os botões já existentes de correção e reenvio, com confirmação.

Aplique também `supabase/migrations/20261025020000_telegram_monitoring.sql` **antes** de publicar esta versão: o registro de avisos passa a usar `email_log.access_notice`. Cache, controle de sincronização e relatórios são privados, com RLS e acesso somente pelo backend.

`vercel.json` agenda a conferência a cada hora, no minuto 7, e o relatório às **23h de Brasília** (`02:00 UTC`). O relatório cobre **23h do dia anterior até 23h do dia do envio**, uma janela contínua de 24 horas, com vendas pagas Payt sem testes, clientes dessas vendas com produto publicado liberado, entregas/falhas/pendências dos avisos e correções/reenvios realizados pelo bot. Movimentos a partir das 23h entram no resumo seguinte, sem lacuna. O cabeçalho mostra as duas datas (por exemplo, `25/10 23h → 26/10 23h (Brasília)`); `report_date` continua sendo a data local do envio. Acesso liberado não comprova login e entrega não comprova leitura. Ações feitas fora do bot não entram no total de suporte.

Configure `TELEGRAM_REPORT_USER_IDS` com os IDs dos destinatários separados por vírgula; eles também precisam estar em `TELEGRAM_ADMIN_USER_IDS`. Na ativação de outubro de 2026, somente o proprietário recebe o relatório. Conceder acesso ao suporte não inscreve automaticamente um colega nos relatórios.

Os endpoints `/api/cron/telegram-sync` e `/api/cron/telegram-report` exigem Bearer `CRON_SECRET` (Vercel) ou o segredo privado do webhook (operação manual). O relatório tenta atualizar os estados antes de enviar; se não conseguir, informa a última conferência concluída. Um envio é reservado por loja, data e destinatário. Em timeout, `telegram_support_reports.state` fica `uncertain`, sem repetição automática: conferir a conversa antes de reconciliar. Não publicar segredos ou respostas brutas do provedor em logs.

## Liberar outro membro da empresa

1. O colega abre [@suporteelevamaxbot](https://t.me/suporteelevamaxbot), pressiona **Iniciar** e envia `/id`.
2. Ele passa o ID numérico ao proprietário. Até ser autorizado, o bot só informa seu próprio ID, sem consultar clientes.
3. O proprietário abre **Gerenciar equipe → Adicionar membro** (ou `/equipe`), responde ao bot com `ID Nome`, confere a identidade e pressiona **Confirmar liberação**.
4. O colega já pode consultar, corrigir e reenviar acessos em chat privado. Para retirar acesso, abra **Gerenciar equipe**, selecione **Remover [nome]** e confirme. Confirmações antigas de suporte são canceladas; ações que já começaram podem terminar. Relatórios exigem inclusão separada em `TELEGRAM_REPORT_USER_IDS`.

Abrir `/equipe` ou **👥 Gerenciar equipe** envia uma nova mensagem; paginação, retorno à equipe e confirmação/cancelamento editam a mensagem atual. A ajuda é compartilhada com o fluxo de clientes e mostra `/equipe` somente para proprietários.

O menu é exclusivo dos IDs em `TELEGRAM_OWNER_USER_IDS`. Proprietários não podem ser adicionados, removidos ou substituídos por esse menu. Operadores não podem gerenciar outros membros. A mudança é registrada em `telegram_team_changes`, com proprietário, alvo, momento e resultado. Confirmações expiram em 15 minutos, são vinculadas ao proprietário e protegidas contra repetição e mudanças posteriores de permissão.

Antes de publicar o gerenciamento, aplique `20261026010000_telegram_team.sql` e configure `TELEGRAM_OWNER_USER_IDS`. Com proprietários configurados, a autorização de operadores passa a vir de `telegram_support_members`, sem cache e sem depender de nova publicação. A lista legada `TELEGRAM_ADMIN_USER_IDS` deixa de autorizar operadores nesse modo. Se houver operadores antigos além do proprietário, migre-os com identidade confirmada antes de ativar. Nesta instalação só havia o proprietário. Sem a variável de proprietários, o modo legado permanece; a variável antiga pode ser omitida no modo novo. Nunca compartilhar token.

## Conciliação de ações de suporte

O bot usa as rotinas existentes `changeCustomerEmail`, `loadStoreAccess`, `buildResendNotice` e `notifyAccess`. Não cria pedidos, migra planos nem remove supressões. A cota diária configurada continua valendo.

Ações ficam em `public.telegram_support_actions`. `processing` ou `uncertain` mantém trava do cliente para impedir duplicação após timeout. O campo `result` distingue correção confirmada de envio não confirmado; `log_id`, quando disponível, aponta o aviso. Se o processo terminar entre enviar e salvar resultado, a ação pode continuar `processing`: não reenviar cegamente.

Para reconciliar, consulte o cliente pelo ID, Auth, compras e os logs de e-mail da mesma janela. Confira cada `provider_id` no Resend. Só depois de provar o resultado, um administrador pode marcar aquela ação específica como `done` e registrar uma descrição da conferência em `result`. Não liberar todas as ações, remover a trava ou mudar para `confirm` para tentar de novo. Quando houver falha definitiva, prepare uma ação nova após resolver a causa.

Logs de aplicação não guardam dados de compradores ou respostas brutas dos provedores. Tabelas privadas contêm endereços e identidade do operador para auditoria: retenção deve preservar ações incertas. Limpeza opcional: excluir somente ações `ready`, `awaiting_email`, `confirm`, `done`, `cancelled` expiradas há mais de 30 dias; manter IDs de updates para impedir replay histórico. A exclusão de cliente/loja elimina suas ações por cascade, sem impedir o fluxo existente.

## Limites e verificações

A consulta lê até vinte linhas de pedidos recentes (deduplicadas por transação/status), exibe até oito compras e oito produtos na ficha com aviso de itens adicionais e examina até oito logs recentes; convites antigos do WhatsApp são excluídos por assunto no Resend. Se o provedor estiver indisponível ou o histórico não estiver retido, o bot informa a limitação. Busca semelhante usa prefixo e pode não localizar toda variação de digitação.

Endpoint: `/api/webhooks/telegram`. Corpo máximo 32 KiB, chat privado, remetente numérico permitido e `X-Telegram-Bot-Api-Secret-Token` comparado em tempo constante. Callbacks usam UUID, sem e-mails/segredos. Configuração incompleta retorna 503 e não acessa clientes. O caminho já é excluído do proxy de sessão por `api/webhooks`.

Checks locais desta atualização: `npm test -- tests/telegram --maxWorkers=2`, `npx tsc --noEmit`, `npx eslint src/lib/telegram src/app/api/webhooks/telegram src/app/api/cron tests/telegram scripts/telegram-support.mjs`. Não exigem build, migração nem chamadas reais aos provedores.
