# Diretrizes da plataforma de áreas de membros

Atualizado em 23/10/2026. Este documento registra a intenção permanente do projeto e o suporte implementado para os próximos produtos. O suporte depende da aplicação da migração e da publicação do código correspondente.

## Plataforma replicável

A área de membros deve servir como base reutilizável para novos produtos, lojas e nichos. Arquitetura é a primeira aplicação da plataforma; novas operações devem reutilizar os fluxos de cadastro, venda, acesso e entrega.

Essa intenção já consta no [objetivo da especificação original](superpowers/specs/2026-09-16-cuspidora-areas-de-membros-design.md): uma plataforma única com várias lojas, onde lançar um produto novo de qualquer nicho é feito por cadastro, sem desenhar telas.

Regras gerais devem ser configuráveis no admin e compatíveis com o cadastrador por pasta. Nomes, códigos Payt, checkouts, conteúdos e liberações de um produto não devem ser fixados no código como solução geral. Particularidades de uma loja devem ter escopo explícito, sem afetar as demais. A estrutura atual usa várias lojas na mesma aplicação; este registro não atesta um processo automático de clonagem para instalações independentes.

## Produtos atuais

Os produtos atuais estão aceitos no modelo existente. A mudança para identificação por checkout se destina aos próximos produtos. Não migrar automaticamente os cadastros, pedidos ou liberações atuais para o novo modelo.

## Próximos produtos: um produto Payt, vários checkouts

Direção solicitada pelo usuário: permitir cadastrar um único produto na Payt e criar checkouts com preços independentes para Básico, Completo e Upgrade. Na área de membros, cada plano deve definir quais produtos e níveis libera, mesmo compartilhando o código de produto Payt com outros planos.

| Plano de compra | Identificação disponível após migração | Liberação configurada |
|---|---|---|
| Básico | Produto Payt + oferta/checkout | Nível Básico dos produtos selecionados |
| Completo | Produto Payt + oferta/checkout | Nível Completo dos produtos selecionados |
| Upgrade por checkout comum | Produto Payt + oferta/checkout | Nível Completo dos produtos selecionados |
| Upgrade pelo recurso de upsell | Produto Payt + identificador de upsell | Nível Completo dos produtos selecionados |

Os nomes acima são exemplos de planos, não uma lista fixa. Combos e outros planos também devem usar liberações cadastradas. A identificação comercial do plano não altera as regras de apresentação das versões Básico e Completo.

### Evidência de viabilidade e limites

O painel da Payt também apresenta um código próprio de checkout na coluna **Código**, conforme imagem fornecida pelo usuário em 02/10/2026. Esse código é distinto do código do produto e é um candidato à referência comercial de cada plano no admin. A imagem comprova sua existência, mas não que ele seja enviado diretamente no webhook nem que corresponda ao código do link curto ou ao identificador da URL final. Confirmar essa associação antes de definir a chave de integração.

Consulta somente de leitura em 02/10/2026: em uma amostra de 100 eventos autenticados da integração atual, compras comuns continham `link.url` com links curtos `payt.site`. Os destinos consultados correspondiam a checkouts específicos; dois links distintos estavam associados ao mesmo código de produto. Eventos de upsell observados não continham `link.url`, mas continham `upsell_code`.

Isso sustenta a adaptação proposta, mas não comprova todos os cenários futuros. Confirmar os identificadores efetivamente enviados para cada novo checkout, upsell, bump e atualização de status antes de ativar sua regra de liberação. O link curto recebido e a URL final do checkout precisam de associação explícita; não presumir que sejam a mesma string.

### Requisitos para a implementação

- Permitir identificar planos por produto + oferta/checkout, mantendo o modelo por código de produto para cadastros existentes.
- Preferir o código próprio do checkout como referência de cadastro quando sua associação com a compra puder ser confirmada. Se o evento trouxer apenas o link, cadastrar a associação entre código do checkout e link recebido, mantendo a decisão de acesso baseada no evento autenticado.
- Cadastrar os identificadores no admin e oferecer representação correspondente na ficha do cadastrador por pasta; não exigir editar código para cada produto novo.
- Usar identificadores confirmados nos eventos autenticados. Não decidir o nível pelo preço pago, título da oferta, UTM ou parâmetro fornecido pelo comprador.
- Para produtos com vários planos por checkout, registrar identificadores desconhecidos ou ausentes para conferência, sem conceder acesso por um fallback ambíguo ao código compartilhado.
- Persistir a identificação do plano na compra e usá-la consistentemente na liberação, nos avisos de acesso e nas atualizações de status. Validar reenvios e eventos que omitam o identificador original.
- Tratar bumps e upsells como linhas/ofertas próprias, sem atribuir automaticamente a todos o plano do checkout principal.
- Preservar acesso concedido por outras compras válidas: por exemplo, reembolsar o upgrade não elimina um Básico ainda pago.
- Validar isolamento entre lojas e compatibilidade dos pedidos antigos.

## Status

**Implementado no código, condicionado à migração `20261023010000_checkout_plans.sql` e à publicação correspondente.** Parser, pedidos, acesso e avisos respeitam o plano persistido. Admin aceita modos `product`, `checkout` e `upsell`, referência administrativa e aliases explícitos. O cadastrador por pasta aceita o modelo legado de códigos distintos e o novo formato compartilhado por links de checkout. Upsells e combos com liberações livres são configurados pelo admin; não há arquivo `planos.json` no cadastrador.

Planos do mesmo código devem ficar na mesma loja e grupo, sem misturar modo por produto com modos específicos e sem aliases sobrepostos. Modo, código Payt e referência de planos existentes são imutáveis; aliases podem ser acrescentados, preservando os anteriores. Pedidos específicos não identificados ficam sem acesso e aparecem para conferência. O código da coluna **Código** do checkout serve somente como referência administrativa; o vínculo usa os identificadores confirmados nos eventos.

Os produtos e pedidos antigos continuam no modelo existente. Não há migração automática, backfill ou reclassificação por preço. O [guia de ofertas com planos](ofertas-com-planos.md) e o [guia do cadastrador](como-cadastrar-produto.md) descrevem os campos suportados e os cuidados de ativação.
