# Recebimento durável dos postbacks Payt

Implementado em 19/10/2026 sobre a revisão de produção `9616978`.

O endpoint anteriormente esperava pedidos, usuário e envio de email antes de responder. Avisos reais levaram 2,7, 3,2 e 9,4 segundos; a Payt registrou timeout mesmo com acessos entregues.

Agora a autenticação e o formato são validados, o aviso é salvo atomicamente em `payt_events` e `payt_inbox`, e a resposta HTTP 200 é enviada. `after()` executa o processamento existente. O cron autenticado `/api/cron/payt-inbox` recupera trabalho a cada cinco minutos. Exige `CRON_SECRET` no ambiente de produção e a migration `20261019010000_payt_inbox.sql`.

## Proteções

- Mesmo identificador de transação, status e conjunto de produtos reutilizam o aviso. Sucesso não é reaberto.
- Mudanças de status e novos bumps continuam sendo tratados; jobs da mesma transação não são executados simultaneamente.
- Lease de cinco minutos, maior que o limite de execução de 60 segundos, e token de fencing impedem conclusão por worker antigo.
- Até cinco tentativas. Uma nova entrega pode recuperar apenas um job terminalmente falho. Não há backfill de eventos antigos.
- Pedidos mantêm a unicidade e precedência de status existentes. A verificação existente de email_log evita reenviar avisos registrados.
- Emails anteriormente pendentes ou falhos continuam sob o fluxo administrativo de reenvio, sem retry automático de email nesta fila. Isto evita duplicidade quando o resultado de um envio externo é incerto.
- Nenhum evento Meta ou Pixel X é enviado por este worker.
- A chave persistida só é usada pelo worker restrito ao service role; o endpoint público continua verificando a chave atual.

## Operação

Falhas após cinco tentativas aparecem como erro no aviso da área administrativa. Consultar `payt_inbox.state`, `attempts`, `last_error` para distinguir falha de processamento de falha de email. Não reenviar compras antigas em massa.

Verificação segura de produção: aviso autenticado com status desconhecido e transação fictícia exclusiva; o processador deve ignorá-lo antes de criar pedido, usuário ou email. Repetir o mesmo aviso deve conservar um único registro na fila.

Rollback: restaurar a implantação anterior. A migration é aditiva e pode permanecer. Antes de desativar o worker, verificar jobs pendentes e concluir a drenagem controlada; nunca reaplicar eventos concluídos. Não apagar a fila nem o histórico para tentar corrigir entregas.

## Validação

Suíte completa: 1.130 testes antes dos dois testes finais de regressão do worker; depois, os 14 testes direcionados passaram. Build de produção, TypeScript, lint dos arquivos alterados e diff-check passaram. A revisão independente validou recuperação, rotação de chave e ausência de alterações no fluxo de envio de email.
