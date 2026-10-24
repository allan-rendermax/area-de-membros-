# Aplicação e reversão — Paisagismo e Patologias

Publicado em 24/10/2026, após autorização explícita nesta conversa. Código `5407f60af7dfab3b3b04b67c55aeb00de75fe5c4`, deployment Vercel `dpl_BN9YsyXmh4ua9XdF3exqVCZ6QvgP` READY, em https://members.grupoelevamax.com/arquitetura. As duas migrations aditivas e a ativação transacional foram aplicadas; Arquitetura está em `grouped`. Outras lojas mantiveram seus valores.

## Conferência comercial e resultado

| Complemento Paisagismo | Produto Payt | Bump | Checkout avulso | Link |
|---|---|---|---|---|
| Guia da Planta Certa | 4E2O9Y | RVKQNL | 4755BA | https://payt.site/bbC2VnW |
| Orçamento de Jardins | RWWEBM | 4ZAWPL | LJPPW3 | https://payt.site/GOCko7K |
| Biblioteca dos Mestres | RD6OKZ | 453QJR | R6GGYY | https://payt.site/JBCaJWw |

Identificadores conferidos no painel Payt. Três checkouts avulsos criados a R$19,90, com Pix e cartão, modelo Digital e sem banners personalizados; as capas aprovadas permanecem na área de membros. Preço-base dos produtos e bumps existentes preservados. Checkout Completo do principal mantém os três bumps.

Postback existente RW9NZY: os 19 produtos anteriores foram preservados e os três produtos de Paisagismo acrescentados. Reabertura confirmou 22 produtos; endpoint, eventos e demais opções permaneceram iguais. Cada complemento possui dois aliases por código (produto/bump), concedendo somente seu próprio acesso completo.

Publicados três produtos, três módulos e sete materiais de Paisagismo; seis relações e seis visibilidades contextuais. As 12 capas e sete arquivos enviados foram relidos e conferidos por SHA-256. Arquivos de entrega estão no bucket privado. Para os PDFs de aproximadamente 98 MiB, o limite global de arquivo passou de 50 para 128 MB; buckets públicos `covers` e `arquivos` ficaram explicitamente limitados aos 50 MiB anteriores. Não houve alteração de cobrança, spend cap ou permissões.

Snapshot posterior e revisão independente confirmaram ofertas, direitos, módulos e itens antigos inalterados; relação singular Protocolo preservada. As três pastas existentes de Patologias foram abertas sem login e seus guias renderizados.

Produção: ofertas internas de ambos os principais; home sem ofertas dos seis; cenário avulso abrindo os cinco materiais de Orçamento de Jardins e navegando para o próximo; endpoint privado gerando URL temporária; acesso sem sessão redirecionando ao login. O navegador bloqueou a abertura automática do download, portanto não se afirma download completo pela interface. Os bytes remotos já haviam sido conferidos no upload. Uma navegação inconsistente durante a ativação não se reproduziu após recarregar; leitura independente não encontrou erro na regra de acesso e nenhum patch foi feito.

Não houve compra artificial, replay histórico ou disparo manual de mensagens. A leitura de pedidos às 17:24 UTC encontrou zero vendas dos novos códigos: Payt → liberação após pagamento real ainda não foi observado ponta a ponta.

## Destinos

| Principal | Complementos, na ordem editorial |
|---|---|
| Atlas Visual de Paisagismo Tropical | Guia da Planta Certa para Jardins Tropicais; Orçamento de Jardins na Prática; Biblioteca Visual dos Mestres do Paisagismo |
| Atlas Visual das Patologias na Construção Civil | Kit Gestão de Obras; Orçamento de Obras na Prática; Kit Captação e Atendimento de Clientes |

Preservar Atlas → Protocolo Anti-Retrabalho no campo singular. Manter os seis materiais como produtos independentes. Não alterar planos, ofertas, compras ou direitos dos produtos já publicados.

## Sequência de publicação

1. Renovar snapshot: deploy, loja Arquitetura, nove produtos envolvidos, ofertas/aliases, imagens, revisões e relações. Comparar com o inventário de preparação. Resolver diferenças antes de gravar.
2. Aplicar as migrations aditivas `20261024020000_contextual_complements.sql` e `20261024021000_save_contextual_product.sql`. Defaults deixam todas as lojas no comportamento anterior. Verificar permissões: relação/RPC indisponíveis a anon/authenticated.
3. Disponibilizar o código testado mantendo a loja em `legacy`. Não ativar outras lojas.
4. Reutilizar os três produtos Patologias pelos UUIDs inventariados. Preservar códigos/aliases Gestão `47ZEA3 / LYZDA4`, Orçamento `RK3NAB / RB67ER`, Captação `LJANBP / RDG68R`. Não recriar ofertas.
5. Confirmar os três códigos e checkouts Paisagismo diretamente na Payt. Criar fichas de cadastro somente com identificadores confirmados. Preparar inicialmente produtos em rascunho, material final e acesso independente; não adivinhar identidade pelo preço ou pelo título.
6. Enviar os arquivos finais e imagens conferidos. Usar `cover_url` para 2:3 e `purchase_image_url` para 1:1. Guardar URLs e hashes anteriores. Importações contextuais usam novos caminhos por versão; não sobrescrever arquivos anteriores. Arquivos sem referência deixados por tentativas recusadas só podem ser removidos após conferência das referências atuais. PDFs maiores devem respeitar o limite real do armazenamento; não presumir que um upload de ~98 MiB cabe no painel.
7. Com tudo pronto, executar relações, visibilidades dos seis e modo `grouped` em uma transação de configuração. Bloquear a linha da loja antes das dos produtos, verificar revisões atuais e usar `save_contextual_product` para cada principal. Não inserir IDs comerciais em migration. Qualquer erro deve abortar a transação inteira.
8. Comparar o snapshot posterior: somente organização editorial/imagens/conteúdo explicitamente preparados podem mudar. Invalidar o cache público de lojas e as rotas. Conferir login e materiais com acessos reais já existentes sem criar pagamentos falsos.
9. Observar a primeira compra real autorizada separadamente para comprovar Payt → direito → material. Não reprocessar históricos ou enviar campanhas automaticamente.

A transação de configuração só deve incluir complementos com material e comércio confirmados. Se um dos seis permanecer pendente, manter seu novo cadastro em rascunho e declarar a ativação parcial explicitamente. Não ocultar uma compra publicada legítima por pendência estética.

## Reversão

Renovar leitura e conferir revisões contra o snapshot posterior para não sobrescrever mudanças de terceiros. Em uma transação, restaurar modo da loja, visibilidades, relações e URLs anteriores. Manter migrations aditivas, produtos vendidos, arquivos e compras. Invalidar o cache público e conferir acessos avulsos. Reversão editorial não deve revogar direitos ou apagar entregas.

## Arquivos do pacote

`artifacts/complementos-contextuais-20261024/aplicacao.json` e `antes.json` preservam a preparação histórica; `depois.json` aponta para esta publicação. Snapshots atualizados, SQL aplicado, manifesto remoto e verificações ficam localmente em `artifacts/publicacao/complementos-contextuais/20261024/`. Não executar novamente a ativação nem usar inventário antigo para sobrescrever alterações posteriores. A reversão deve partir dos snapshots atualizados e de nova leitura.

