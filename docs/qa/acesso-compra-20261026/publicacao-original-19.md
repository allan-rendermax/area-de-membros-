# Publicação da versão original de 19/10

Autorizada pelo usuário em 27/10/2026, após conferir a prévia. Restaurar a apresentação aprovada, preservando a homepage, as correções de segurança e os produtos/order bumps atuais.

## Alteração

Componentes visuais recuperados do commit `b56dc4c8cce9cd805820049c1c829abda25a1f32`, integrados sobre a produção atual `fb3cf883ab8f989911dbe64324bb251873b4f102`. Nenhum rollback de dependências, autenticação, Payt ou regras de acesso.

O catálogo requer uma alteração pontual no Atlas: retirar de publicação quatro itens de download individual e restaurar o título/ordem de “Acesse seu bônus”. Os registros e arquivos permanecem guardados. A operação compara o estado atual com o backup e aborta se houver divergência. Nenhum produto, módulo, oferta, relação ou pedido deve ser restaurado globalmente.

Links explícitos de oferta de complementos (`?complemento=...`) continuam abrindo somente a oferta solicitada, validada contra relação, loja, publicação e acesso. Isso corrige uma regressão encontrada na revisão sem acrescentar blocos à tela normal aprovada.

## Verificação antes da publicação

- 1465 testes aprovados em 178 arquivos, com dois workers para evitar saturação da máquina nos testes de banco.
- Um teste de indisponibilidade foi ajustado para desativar o retry do cliente apenas no mock; confirma descarte de uma página parcial após 503. Código de produção inalterado nesse fluxo.
- Build de produção e ESLint dos componentes/rota aprovados.
- Homepage, `src/lib`, APIs, migrations e dependências sem diferenças em relação à produção anterior.
- 24 páginas de produto, incluindo 12 order bumps e um upsell, responderam corretamente na simulação administrativa de produção antes da mudança.
- Atlas Básico e Completo entregaram PDF real, 13.301.413 bytes, assinatura `%PDF-`; rota sem sessão redirecionou para login. Bônus apontou à pasta original.

## Backup

Pasta externa: `C:/Users/arqal/OneDrive/Desktop/Backups Area de Membros/2026-10-27-original-19-outubro/`.

Contém exportação do catálogo anterior, snapshot histórico de 19/10, patch aprovado e bundle Git com histórico completo da produção anterior, verificado com `git bundle verify`. Após publicar, acrescentar catálogo final, bundle/tag da versão aprovada, manifesto de hashes e instruções de recuperação.

O backup cobre código e catálogo, não é uma cópia integral de clientes/pedidos nem dos bytes de todos os materiais. Os arquivos de materiais existentes não são removidos nesta operação. A pasta está dentro do OneDrive; sincronização remota depende do cliente OneDrive.

## Resultado da publicação

Pendente neste registro inicial. Atualizar com commit, deployment e comparação final do catálogo após a publicação.
