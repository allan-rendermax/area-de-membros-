# Atlas Visual de Urbanismo — publicado

Publicação concluída em 23/10/2026 na loja Arquitetura, com o nome aprovado pelo usuário. A plataforma identifica novos planos por checkout ou upsell configurado; os produtos existentes permanecem no modelo por código de produto.

- [Produto na área de membros](https://members.grupoelevamax.com/arquitetura/produto/atlas-visual-de-urbanismo).
- [Cadastro administrativo](https://members.grupoelevamax.com/admin/produtos/1c90a301-3687-405d-bae4-11b6e671d716).
- Produto `1c90a301-3687-405d-bae4-11b6e671d716`; slug `atlas-visual-de-urbanismo`.
- Trilha Atlas Visuais, papel Front, ordem 4, organização em versões.
- Básico: Atlas Visual de Urbanismo (1 material).
- Completo: Atlas e quatro bônus — Quadros Visuais de Densidade e Forma Urbana, Banco de Partidos Urbanísticos, Roteiro de Seminário e Cidades que Inspiram (5 materiais).

## Identificação e entrega

Um único produto Payt, `LG5BGY`, está associado ao grupo `2604a9ed-18aa-44fa-b9d6-0e9a9afb5cb4`. A referência administrativa do checkout é independente dos links recebidos; cada plano possui o link curto e o checkout final como aliases confirmados.

| Plano | Referência | Link curto | Checkout final | Acesso |
|---|---|---|---|---|
| Básico | R272NA | https://payt.site/8oClGKV | https://checkout.payt.com.br/bf9a56b000e84f756c369603b3685d84 | basic |
| Completo | LJPMZ2 | https://payt.site/zZC7Wyr | https://checkout.payt.com.br/4743cffb835703dfda2a66afec68bc1d | complete |
| Completo promocional | R6GZ2X | https://payt.site/oMC85v5 | https://checkout.payt.com.br/b06e76357558788e6a20187af8b4d525 | complete |

O terceiro checkout, chamado Upgrade na Payt, cobra a oferta integral promocional. Por isso, `upgrade_checkout_url` permanece vazio: ele não foi apresentado como diferença de preço a quem já comprou Básico.

A integração de entrega Payt `RW9NZY` recebeu somente `LG5BGY`, preservando seus 16 produtos anteriores, endpoint, estado ativo, eventos e preferências. São processados aprovação, cancelamento, chargeback e reembolso. A integração separada de UTMify foi preservada.

A identificação usa dados de eventos autenticados, sem deduzir o plano por preço ou título. Aliases desconhecidos não concedem acesso. O plano persistido acompanha o pedido nos reenvios e reembolsos. O painel e o cadastrador por pasta permitem configurar próximos produtos sem alterar código.

## Capa e arquivos

Capa original criada com a ferramenta integrada de imagens, seguindo azul-marinho, laranja, diagonal amarela e a linguagem dos demais produtos. A cena usa bairro arborizado, ciclovia, rio e ponte, com a identidade do Urbanismo. WebP de 1024 × 1536 px, proporção 2:3, 539.230 bytes.

A capa está no bucket público `arquivos`; os cinco PDFs estão no bucket privado `arquivos-restritos`. Os seis arquivos enviados tiveram seus hashes remotos conferidos. O PDF principal foi reduzido de 58.975.418 para 45.841.859 bytes apenas removendo ASCII85 redundante, sem recomprimir imagens ou alterar as 51 páginas. O original foi preservado; conteúdo, imagens e renderização foram comparados.

## Publicação e validação

- Código funcional publicado no commit `2db144f587aeaa7b668baca70508aa4932d4a515`, após revisão independente sem achados bloqueantes.
- Migração `20261023010000_checkout_plans.sql` aplicada em transação, após ensaio com rollback, e registrada no histórico. MD5 da fonte e do registro: `9a30317e35f9aaee79ece00912221e77`.
- Deployment inicial validado: `dpl_Dxq61KkHvhyf1tEaJiaAYPDkEbdn`, estado READY, com os domínios `members.grupoelevamax.com` e `area-de-membros-taupe.vercel.app`.
- 151 arquivos de teste, 1.234 testes aprovados; TypeScript e build de produção aprovados. Lint sem erros, com três avisos preexistentes em arquivos não alterados; aviso Vite herdado também permanece.
- Teste autenticado de conexão respondeu HTTP 200 como teste ignorado, sem criar pedido, cliente ou e-mail.
- Planos reais conferidos com o cálculo de permissões da aplicação: Básico libera somente basic; os dois checkouts Completo liberam complete; plano desconhecido não libera o Atlas.
- Painel em produção confirma produto publicado e contagem 1/5. Simulações visuais Básico e Completo conferidas no navegador desktop. Não há alegação de teste visual mobile.
- PDF privado recusou acesso público (HTTP 400); visitante sem sessão foi redirecionado ao login (HTTP 307).
- Comparação antes/depois: os outros 12 produtos, todos os 20 módulos, 34 itens, 12 grupos antigos, 20 ofertas antigas e 20 vínculos antigos permaneceram iguais. Foram acrescentados somente um grupo e três planos/vínculos para Urbanismo, além da publicação do próprio produto.

## Compras anteriores recuperadas

As duas compras Completo inicialmente encontradas foram revalidadas no painel Payt, regularizadas e tiveram seus e-mails enviados conforme autorização explícita. Na conferência da janela de ativação foi encontrada uma terceira compra aprovada do Básico, realizada antes da ativação; o usuário também autorizou sua regularização e envio.

Resultado: **três compras recuperadas, dois acessos Completo e um Básico, três e-mails de acesso enviados e aceitos pelo provedor**, com um registro de envio por cliente/produto. Isso confirma a aceitação dos envios pelo provedor, não a leitura das mensagens pelos compradores.

A recuperação usou as referências originais das vendas com a RPC normal de pedidos, preservando o vínculo para futuros reembolsos. A equivalência entre referência da venda e `transaction_id` foi conferida em uma venda anterior com evento autenticado. Não foram fabricados webhooks de compras. Dados pessoais dos compradores ficaram somente nos artefatos operacionais privados locais, fora do Git.

As evidências operacionais estão em `artifacts/urbanismo-cadastro/` do checkout original: `migration-verified.json`, `deploy-domain.json`, `payt-delivery-persisted.json`, `cadastros-preservados.json`, `publicacao-verificada.json`, `additional-send-report.json`, capturas do painel e revisões arquivadas. Os scripts de recuperação têm etapas explícitas e verificam o estado antes de enviar; não devem ser usados como importador genérico.
