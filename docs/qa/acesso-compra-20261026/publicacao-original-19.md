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

Publicado via PR #5, merge `16c09952edd3f90f288df1c965d753965696594c`. Deployment `dpl_27JZNPjmDW4WPLqqvi6XkLFvCw7V` READY; o alias `members.grupoelevamax.com` foi confirmado nesse deployment.

Comparação integral das dez tabelas exportadas: mesmos 24 produtos, 33 módulos, 71 itens, 47 ofertas, 24 grupos, 47 vínculos de oferta, seis relações de complementos e quatro materiais legados. Somente seis campos de cinco itens do Atlas mudaram, exatamente conforme o plano: quatro `is_published`, título e ordem do bônus. Nenhum registro foi removido. Todos os outros campos/tabelas permaneceram idênticos.

Verificação posterior em produção: 24/24 páginas abriram, incluindo 12 order bumps e um upsell; títulos e 24 links de produtos da homepage ficaram idênticos ao registro anterior. Simulação administrativa do Atlas validou dois acessos no Completo e um no Básico, em 1440/918/390px, sem overflow nem erros JavaScript. Link explícito de oferta de Kit Gestão de Obras também validado. Não foram criadas compras nem modificadas liberações de compradores para testar.

Os links reais do Atlas Básico/Completo e da pasta de bônus foram reconferidos depois da publicação. As três subpastas de bônus foram abertas sem login no Google, com seus checklists, modelos e referências disponíveis. Permissões do Drive não foram modificadas. Rotas sem sessão continuam exigindo login; as checagens públicas de login/admin/manifest/Speed Insights passaram.

Backup remoto de código: tag `backup/layout-original-19-outubro-aprovado-20261027` no GitHub, apontando ao commit aprovado `9e2e36f78b239ef4a078865cff57b26c0e1103ab`, cujo código coincide com o merge publicado. Bundle completo verificado e cópia ZIP na pasta externa; catálogo final e manifesto de hashes adicionados. O backup é de código e catálogo; não contém a base de clientes/pedidos nem os bytes de todos os materiais.
