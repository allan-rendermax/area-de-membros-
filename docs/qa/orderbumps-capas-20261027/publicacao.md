# Publicação dos complementos abaixo do Protocolo

Autorizada pelo usuário em 27/10/2026, após conferir a posição final na prévia. Código aprovado `efec391`: materiais, banner do Protocolo e, logo abaixo, os cards dos complementos. O banner não foi redesenhado.

## Escopo

Reutilizar os cards existentes, preservando o layout da página inicial, regras de acesso, autenticação, Payt, migrations e dependências. Comprados levam ao material; não comprados à oferta com checkout cadastrado. Nenhum download individual do Atlas é reintroduzido.

Catálogo: restaurar as três capas históricas e a presença na vitrine de Kit Gestão de Obras, Kit Captação e Atendimento de Clientes e Orçamento de Obras na Prática. Preservar as relações existentes e acrescentar as seis associações de Hospitalar/Urbanismo. O plano de dados limita a operação a seis campos de três produtos e seis relações novas. Nenhum material, módulo, produto, checkout, oferta ou pedido será removido.

Os seis complementos Hospitalar/Urbanismo continuam sem checkout avulso cadastrado. Acesso adquirido preservado; nenhum checkout ou preço é criado por esta publicação.

## Proteção e recuperação

Antes da publicação: exportação das dez tabelas de catálogo, comparação com a prévia aprovada e bundle completo de `origin/main`, validado com `git bundle verify`. A operação SQL usa transação e aborta caso os três produtos tenham mudado desde o snapshot.

Backup separado: `C:/Users/arqal/OneDrive/Desktop/Backups Area de Membros/2026-10-27-complementos-abaixo-protocolo/`. O backup original de 19/10 permanece intacto.

Este backup cobre código e catálogo; não substitui o backup de clientes/pedidos nem contém todos os bytes dos materiais. A sincronização remota da pasta depende do OneDrive.

## Verificações antes da publicação

- Build de produção aprovado.
- Diff da homepage, bibliotecas de acesso/autenticação, APIs, migrations e dependências vazio contra `16c09952edd3f90f288df1c965d753965696594c`.
- Catálogo atual igual ao snapshot da prévia antes de aplicar as alterações.
- 24 páginas de produto, incluindo 12 order bumps, abertas com simulação administrativa autenticada; 24 links de produtos registrados na página inicial.
- Atlas Básico e Completo entregam o arquivo real, com assinatura PDF e resposta parcial 206; rota anônima exige login. Link de bônus mantém a pasta original.

Resultado da publicação e validação posterior serão acrescentados após confirmação do deployment e do catálogo.
