# Imagens do formulário de produto

Cada imagem é enviada diretamente ao bucket `covers`, individualmente, com limite de 2 MB. O formulário final envia somente URLs e comprovantes assinados. Um comprovante vale por 24 horas e fica vinculado à loja, ao produto (ou à criação de um novo produto) e ao campo correspondente. Antes de gravar a referência, o servidor confere o tamanho e o tipo do objeto no Storage. Referências já salvas podem ser mantidas sem novo comprovante.

Objetos novos ficam em `product-drafts/<store-id>/<product-id|new>/<slot>-<uuid>.<ext>`. Um erro de salvamento conserva as referências já enviadas enquanto a página permanece aberta. Um upload que falhou pode ser repetido; objetos substituídos ou abandonados não são excluídos automaticamente, pois a mesma imagem pode continuar referenciada.

## Limpeza futura de objetos não utilizados

A limpeza precisa gerar primeiro um inventário somente de leitura desse prefixo. Comparar as URLs exatas com `products.cover_url`, `banner_url`, `purchase_image_url`, `upgrade_image_url` e eventuais referências em outros campos de imagem. Considerar candidatos apenas objetos com mais de sete dias e sem nenhuma referência. Guardar o manifesto de candidatos para revisão e reconferir as referências imediatamente antes de qualquer exclusão deliberada. Nunca selecionar o bucket inteiro, imagens anteriores a esse prefixo ou arquivos dos materiais.

Não há rotina de exclusão automática nesta alteração. O prazo de sete dias é uma margem operacional para rascunhos; a expiração do comprovante, isoladamente, não torna uma imagem descartável.
