# Revisão independente e correções

Revisão independente por agente separado, em modo somente leitura, sobre `635eb54..3962639`. Foram encontrados três problemas importantes e nenhum crítico ou menor. A revisão considerou aquele commit ainda não pronto para integração. O implementador reproduziu e corrigiu os três problemas numa única rodada; não houve uma segunda revisão independente.

| Achado | Correção | Verificação |
|---|---|---|
| Importador ordenava product_complements por id inexistente | Ordenação pelas três colunas da chave composta | Requisição emitida pelo cliente Supabase: RED com id.asc, GREEN com store_id,parent_product_id,complement_product_id |
| Upload podia substituir imagem/entregável antes de um salvamento recusado | Novos caminhos por versão, upsert desativado no cadastro contextual; URLs anexadas depois do sucesso | RED: bytes antigos substituídos; GREEN: bytes e URL anteriores preservados após 40001. Caminhos públicos e privados conferidos no sucesso |
| Navegação de itens perdia compras simuladas | Cenário transmitido para barra, lista lateral, recursos e atualização de acesso | RED: parâmetros ausentes no HTML; GREEN: preservados. Cliques reais em próximo/anterior/lista lateral nos cenários 1/todos/avulsos |

Após as correções: 44/44 testes focados, suíte inteira com 1.286/1.286 testes em 162 arquivos. Lint: zero erros, três avisos preexistentes. O relatório principal registra build e navegação finais.

Uploads contextuais recusados podem deixar arquivos novos sem referência, sem substituir os anteriores. Não há remoção automática após resposta ambígua: a gravação pode ter ocorrido e a resposta ter se perdido. Uma limpeza posterior exige conferir referências salvas. A operação completa de módulos e ofertas continua usando o fluxo existente; a atomicidade nova cobre campos do produto e lista de complementos.

Não avaliado como produção: cumprimento comercial dos três novos complementos Paisagismo, ativação/reversão real ou auditoria editorial integral dos PDFs. Essas limitações permanecem explícitas no plano de publicação.
