# Bot de suporte ElevaMAX no Telegram

Escopo aprovado no chat em 25/10/2026: consultar e-mails, corrigir cadastro e reenviar acesso por botões. Bot escolhido: @suporteelevamaxbot. Executar nesta sessão. Credenciais e autorização do usuário serão configuradas na ativação.

## Uso

Enviar até cinco e-mails por mensagem. Mostrar cliente, compras da loja configurada, produtos e níveis efetivamente liberados, bloqueio e último aviso de acesso consultado no Resend. Não tratar aceitação da API como entrega. Sem cadastro exato, oferecer candidatos por prefixo do endereço; seleção explícita, nunca correção presumida.

Reenviar: botão abre resumo com destinatário e confirmação. Corrigir: botão solicita novo endereço como resposta à mensagem do bot; mostrar anterior → novo e confirmar **corrigir e reenviar**. A correção é global, como a ação existente do admin; o reenvio pertence à loja configurada. Preservar compras, planos e UUID do cliente.

## Implementação

Webhook Next.js `/api/webhooks/telegram`, sem serviços de IA ou novas dependências. Configuração por variáveis privadas: token, segredo do webhook, IDs permitidos e slug da loja. Reaproveitar `changeCustomerEmail`, `loadStoreAccess`, `buildResendNotice`, `notifyAccess` e limites diários. Cliente HTTP do Telegram com timeout e erros sanitizados.

Tabelas privadas `telegram_support_updates` e `telegram_support_actions`: deduplicação persistente de updates; ações vinculadas ao operador, chat privado, cliente, loja, e-mail esperado e prazo de 30 minutos. Tokens UUID nos botões. Claim por update condicional; trava única por cliente durante execução ou resultado incerto. Nenhuma credencial ou dado pessoal em logs de aplicação.

Antes de executar, revalidar cadastro, Auth, bloqueio, email esperado, compras/acesso, proteção de admins, destino sem conflito e quota. Confirmar autenticação do webhook por comparação constante e remetente pela lista numérica. Negar grupos, operadores desconhecidos, conteúdo inválido e callbacks expirados/alterados. Repetição não envia novamente.

Falha ou timeout após início deixa ação incerta, sem repetição automática. Correção e envio são resultados separados. E-mail aceito é informado como aceito; botão de atualizar consulta novamente. Ações incertas exigem conferência no admin/provedor antes de liberar a trava. Não remover supressões ou corrigir domínios por inferência.

## Testes e ativação

Testes do fluxo com memória, SQL real no PGlite, adapters de consulta e webhook/configuração. Cobrir autorização, replay, clique simultâneo, destinatário alterado, resposta ao prompt errado, cadastro bloqueado/conflitante, correção preservada e status indisponível. Rodar testes relacionados, TypeScript, lint e build.

Script de ativação: verificar bot, descobrir usuário após /start por getUpdates antes do webhook, configurar comandos e registrar webhook HTTPS com secret_token. Não imprimir token e não descartar updates. Sem token, entregar implementação testada e instrução exata; não declarar bot ativo.

Não publicar a árvore principal com alterações alheias. A produção atual contém evolução além do HEAD local: ativação exige levar somente os arquivos do bot ao código publicado ou a uma base equivalente verificada.
