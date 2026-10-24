# Aplicação e reversão — Paisagismo e Patologias

Pacote preparado localmente. Publicação/ativação não executada. Base remota verificada: `635eb541765bf3d8d8f0d2fff9cdf04047b8864a`. Antes da execução, conferir se o deploy mudou e integrar alterações posteriores.

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
6. Enviar os arquivos finais e imagens conferidos. Usar `cover_url` para 2:3 e `purchase_image_url` para 1:1. Guardar URLs e hashes anteriores. PDFs maiores devem respeitar o limite real do armazenamento; não presumir que um upload de ~98 MiB cabe no painel.
7. Com tudo pronto, executar relações, visibilidades dos seis e modo `grouped` em uma transação de configuração. Bloquear a linha da loja antes das dos produtos, verificar revisões atuais e usar `save_contextual_product` para cada principal. Não inserir IDs comerciais em migration. Qualquer erro deve abortar a transação inteira.
8. Comparar o snapshot posterior: somente organização editorial/imagens/conteúdo explicitamente preparados podem mudar. Invalidar o cache público de lojas e as rotas. Conferir login e materiais com acessos reais já existentes sem criar pagamentos falsos.
9. Observar a primeira compra real autorizada separadamente para comprovar Payt → direito → material. Não reprocessar históricos ou enviar campanhas automaticamente.

A transação de configuração só deve incluir complementos com material e comércio confirmados. Se um dos seis permanecer pendente, manter seu novo cadastro em rascunho e declarar a ativação parcial explicitamente. Não ocultar uma compra publicada legítima por pendência estética.

## Reversão

Renovar leitura e conferir revisões contra o snapshot posterior para não sobrescrever mudanças de terceiros. Em uma transação, restaurar modo da loja, visibilidades, relações e URLs anteriores. Manter migrations aditivas, produtos vendidos, arquivos e compras. Invalidar o cache público e conferir acessos avulsos. Reversão editorial não deve revogar direitos ou apagar entregas.

## Arquivos do pacote

`artifacts/complementos-contextuais-20261024/aplicacao.json` lista alvos e assets; `antes.json` é inventário de preparação, marcado para renovação; `depois.json` informa que nenhuma aplicação ocorreu; `rollback.json` guarda campos a restaurar. Não são autorização nem comandos para aplicar um snapshot antigo.

