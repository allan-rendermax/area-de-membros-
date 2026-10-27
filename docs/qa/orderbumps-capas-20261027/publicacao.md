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

## Publicação confirmada

PR #6 integrado, commit de produção `7f52b00e6014f08096b720134be2ba12fa5031ca`. Vercel `dpl_CrTT5uRxYvB6TwUeJxBVadc1f9UC` em READY; alias `members.grupoelevamax.com` confirmado nesse deployment. Código publicado idêntico ao aprovado após conciliar o histórico Git, sem mudança nos arquivos.

A suíte final passou com 1.469 testes em 178 arquivos, `--maxWorkers=2`. Build de produção aprovado e preview da Vercel também aprovado antes do merge.

## Catálogo e links após publicação

Comparação integral das dez tabelas exportadas: 24 produtos, 33 módulos, 71 itens, 47 ofertas, 24 grupos de ofertas, 47 vínculos de oferta, quatro materiais legados e zero materiais por oferta preservados. Relações de complementos passaram de seis para doze. Nenhum registro removido. Somente as seis alterações editoriais planejadas ocorreram, além dos metadados automáticos dos triggers existentes: revisão dos três produtos e revisão/data dos dois Atlas que receberam relações.

Atlas Básico/Completo retornaram o arquivo real via link autorizado: HTTP 206, 13.301.413 bytes, assinatura PDF. Acesso anônimo continuou redirecionando ao login. Pasta original de bônus e suas três subpastas abertas anonimamente, com dez arquivos conferidos. Nenhuma permissão de arquivo foi alterada.

Sete checkouts existentes abertos no navegador com formulário de pagamento: três complementos de Patologias, três de Paisagismo e Protocolo. Títulos correspondentes conferidos; nenhum pagamento realizado. Os seis complementos Hospitalar/Urbanismo permanecem sem checkout avulso.

Backup remoto: tag `backup/complementos-abaixo-protocolo-20261027` no GitHub, apontando ao merge publicado. Bundle completo verificado e ZIP do código na pasta externa. O backup antigo e sua tag continuam intactos.

Navegador em produção: 18 verificações aprovadas com agent-browser, sem erros JavaScript. Conferidos 1440/918/390/320px sem transbordamento, dois materiais no Completo e um no Básico, cards abaixo do banner, nenhum/um/todos complementos adquiridos, modais com checkout correto e imagens carregadas, relações dos outros três Atlas, três ofertas na vitrine e acesso de compra avulsa. Testes feitos em simulação administrativa autenticada, sem criar pedidos ou modificar liberações de compradores.

Auditoria posterior: 24/24 páginas publicadas responderam HTTP 200 com o título correto, incluindo os 12 order bumps e um upsell. Os 24 destinos de acesso da página inicial foram preservados; as seis novas relações apenas agrupam seus complementos nos Atlas correspondentes. Layout da página inicial sem mudança de código.
