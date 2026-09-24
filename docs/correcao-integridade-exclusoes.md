# Integridade das exclusões

Corrige os dois problemas encontrados na revisão de 24/09/2026.

## Liberação manual e exclusão concorrentes

`create_manual_order_atomic` recebe os IDs da loja, oferta e cliente, valida os registros atuais e grava o pedido em uma transação. Locks de escrita/leitura impedem a exclusão de invalidar essas referências durante a gravação. Se a exclusão já concluiu, a liberação falha em vez de usar dados de uma leitura antiga.

O trigger `guard_manual_order_references` também valida INSERTs manuais do código anterior durante o deploy. Ele não intercepta a atualização de e-mail dos pedidos, que permanece na transação administrativa existente.

## Histórico após corrigir e-mail

- `payt_events.customer_id` e `login_attempts.customer_id` usam FK com ON DELETE CASCADE.
- Avisos são vinculados por identidade única encontrada no e-mail atual ou na transação persistida. Um aviso já vinculado não é transferido quando o e-mail é reutilizado por outra conta.
- Tentativas de login são gravadas junto com o ID atual, sem guardar novo campo de e-mail em texto aberto na tabela.
- A correção de e-mail vincula tentativas anteriores pelo hash e período da conta, na mesma transação que atualiza os dados públicos. O hash é calculado no servidor; o segredo não é transmitido ao banco.
- A exclusão prioriza o ID estável e não remove registros já vinculados a outra conta.

## Implantação

Aplicar `20260924050000_deletion_integrity.sql` antes de publicar o código. Ela acrescenta colunas/índices/triggers, funções novas e atualiza a função de exclusão. A atribuição de avisos existentes só ocorre quando há identidade única identificável.

A auditoria anterior à aplicação encontrou 0 clientes, 0 pedidos, 0 registros de e-mail, 8 avisos Payt e 14 tentativas de login. Não havia clientes legados ou aliases em email_log para recuperar. Registros de contas já excluídas não podem receber retroativamente um vínculo sem evidência; não foram apagados nem atribuídos por suposição. Os novos vínculos corrigem o fluxo de agora em diante.

Rollback de app: as colunas novas são compatíveis com a versão anterior, mas o código anterior volta a registrar tentativas sem ID e usa a correção de e-mail sem hash histórico. Preferir correção para frente; não remover a migração com dados vinculados.

## Verificação

- 766 testes em 99 arquivos, build Next.js/TypeScript e ESLint dos arquivos alterados aprovados.
- Novos testes SQL cobrem ordens de execução grant→delete e delete→grant, oferta removida/outra loja, INSERT legado tardio, duas trocas de e-mail, reuso do endereço por outro cliente, preservação de eventos vinculados, tentativas anônimas e rollback.
- Testes de fronteira verificam que os helpers usam RPC, sem fallback para a gravação manual vulnerável.
- Revisão independente aprovada no escopo.
- PGlite executa as migrações reais e cenários ordenados; não é teste de carga ou duas conexões PostgreSQL simultâneas.
- Novos avisos externos da Payt podem continuar recriando cadastro/pedidos; a opção de exclusão não é um bloqueio permanente por e-mail.
- Avisos ambíguos continuam sem dono único e seguem o fallback existente de exclusão por e-mail/transação. Não se promete preservar separadamente um único registro que representa identidades conflitantes.
