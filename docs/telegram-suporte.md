# Suporte ElevaMAX no Telegram

Bot: [@suporteelevamaxbot](https://t.me/suporteelevamaxbot). Implementação sem serviço de IA e sem computador local ligado. A ativação depende do token do BotFather, ID permitido, migração e publicação do endpoint.

## Operação pelo celular

- Envie até cinco e-mails em uma mensagem: o bot confere pedidos recebidos pela plataforma, plano efetivo, bloqueio e último aviso de acesso no Resend. Não consulta o painel Payt ao vivo nem inventa compra ausente.
- Sem cadastro exato, mostra até cinco endereços com prefixo semelhante para seleção manual. Não corrige automaticamente domínios ou nomes.
- **Reenviar acesso** mostra o destinatário e exige **Confirmar envio**.
- **Corrigir e-mail** solicita resposta ao prompt do bot. Responda diretamente com um endereço. O resumo anterior → novo pede **Confirmar correção e envio**.
- A correção afeta o cadastro/login e as compras em todas as lojas, como no admin. O reenvio pertence somente à loja configurada.
- **Atualizar consulta** e **Conferir cadastro e envio** buscam o estado atual. “Aceito pelo provedor” não comprova entrega; “entregue” é confirmação do servidor do destinatário.

Botões expiram em 30 minutos e só funcionam para o operador e chat privado de origem. Acesso bloqueado, ausência de produtos, conta administrativa, mudança de destinatário e conflito com outro login impedem a ação. Um clique repetido não dispara novamente. Os testes não mandam mensagens a clientes.

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

## Falha ou resultado incerto

O bot usa as rotinas existentes `changeCustomerEmail`, `loadStoreAccess`, `buildResendNotice` e `notifyAccess`. Não cria pedidos, migra planos nem remove supressões. A cota diária configurada continua valendo.

Ações ficam em `public.telegram_support_actions`. `processing` ou `uncertain` mantém trava do cliente para impedir duplicação após timeout. O campo `result` distingue correção confirmada de envio não confirmado; `log_id`, quando disponível, aponta o aviso. Se o processo terminar entre enviar e salvar resultado, a ação pode continuar `processing`: não reenviar cegamente.

Para reconciliar, consulte o cliente pelo ID, Auth, compras e os logs de e-mail da mesma janela. Confira cada `provider_id` no Resend. Só depois de provar o resultado, um administrador pode marcar aquela ação específica como `done` e registrar uma descrição da conferência em `result`. Não liberar todas as ações, remover a trava ou mudar para `confirm` para tentar de novo. Quando houver falha definitiva, prepare uma ação nova após resolver a causa.

Logs de aplicação não guardam dados de compradores ou respostas brutas dos provedores. Tabelas privadas contêm endereços e identidade do operador para auditoria: retenção deve preservar ações incertas. Limpeza opcional: excluir somente ações `ready`, `awaiting_email`, `confirm`, `done`, `cancelled` expiradas há mais de 30 dias; manter IDs de updates para impedir replay histórico. A exclusão de cliente/loja elimina suas ações por cascade, sem impedir o fluxo existente.

## Limites e verificações

A consulta exibe até vinte linhas de pedidos recentes (deduplicadas por transação/status) e examina até oito logs recentes; convites antigos do WhatsApp são excluídos por assunto no Resend. Se o provedor estiver indisponível ou o histórico não estiver retido, o bot informa a limitação. Busca semelhante usa prefixo e pode não localizar toda variação de digitação.

Endpoint: `/api/webhooks/telegram`. Corpo máximo 32 KiB, chat privado, remetente numérico permitido e `X-Telegram-Bot-Api-Secret-Token` comparado em tempo constante. Callbacks usam UUID, sem e-mails/segredos. Configuração incompleta retorna 503 e não acessa clientes. O caminho já é excluído do proxy de sessão por `api/webhooks`.

Checks: `npm test -- tests/telegram --maxWorkers=2`, `npx next typegen`, `npx tsc --noEmit`, `npx eslint src/lib/telegram src/app/api/webhooks/telegram tests/telegram scripts/telegram-support.mjs`, `npm run build`.
