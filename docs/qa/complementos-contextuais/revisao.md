# Revisão independente e correções

Revisão independente por agente separado, em modo somente leitura, sobre `635eb54..3962639`. Foram encontrados três problemas importantes e nenhum crítico ou menor. A revisão considerou aquele commit ainda não pronto para integração. O implementador reproduziu e corrigiu os três problemas numa única rodada; a publicação recebeu posteriormente uma revisão independente adicional, registrada abaixo.

| Achado | Correção | Verificação |
|---|---|---|
| Importador ordenava product_complements por id inexistente | Ordenação pelas três colunas da chave composta | Requisição emitida pelo cliente Supabase: RED com id.asc, GREEN com store_id,parent_product_id,complement_product_id |
| Upload podia substituir imagem/entregável antes de um salvamento recusado | Novos caminhos por versão, upsert desativado no cadastro contextual; URLs anexadas depois do sucesso | RED: bytes antigos substituídos; GREEN: bytes e URL anteriores preservados após 40001. Caminhos públicos e privados conferidos no sucesso |
| Navegação de itens perdia compras simuladas | Cenário transmitido para barra, lista lateral, recursos e atualização de acesso | RED: parâmetros ausentes no HTML; GREEN: preservados. Cliques reais em próximo/anterior/lista lateral nos cenários 1/todos/avulsos |

Após as correções: 44/44 testes focados, suíte inteira com 1.286/1.286 testes em 162 arquivos. Lint: zero erros, três avisos preexistentes. O relatório principal registra build e navegação finais.

Uploads contextuais recusados podem deixar arquivos novos sem referência, sem substituir os anteriores. Não há remoção automática após resposta ambígua: a gravação pode ter ocorrido e a resposta ter se perdido. Uma limpeza posterior exige conferir referências salvas. A operação completa de módulos e ofertas continua usando o fluxo existente; a atomicidade nova cobre campos do produto e lista de complementos.

Na revisão inicial, comércio e ativação real ainda não estavam avaliados. A revisão adicional abaixo cobre a publicação. Reversão real, auditoria editorial integral dos PDFs e entrega após pagamento real não foram executadas.

## Revisão independente da publicação — 24/10/2026

Agente separado, somente leitura, revisou a transação antes da execução e comparou independentemente os snapshots antes/depois. Nenhum bloqueio. Ajuste menor de limpeza de tabela temporária ON COMMIT DROP aplicado antes da execução.

Confirmou: seis relações na ordem correta; três produtos novos com módulos e sete itens; seis aliases liberando somente seu próprio complemento; ofertas, módulos, itens e vínculos antigos preservados; Protocolo preservado; 19 URLs correspondentes ao manifesto de uploads.

Também revisou o relato de desvio na navegação avulsa: código não depende do principal para conceder acesso, navegação direta e clique após recarregar funcionaram; sem reprodução consistente, não recomendou alteração. Compras reais não foram simuladas nem declaradas como testadas.

## Revisão geral de encerramento — 24/10/2026

Revisão independente detectou duas inconsistências apenas na prévia administrativa: complemento adquirido em sections herdava o nível Básico do principal; download ignorava a aquisição simulada e perdia o cenário em redirects. A resolução contextual simulada agora é compartilhada por home, produto, item e download. Selecionar um complemento sections simula sua compra completa; versions continua respeitando a versão selecionada. Esse contrato é exclusivo da prévia e não concede direitos reais nem afirma cobertura de planos futuros de sections.

Cinco testes adicionais cobrem one/all/solo com principal Básico, download sem complemento adquirido e bloqueio versions preservando solo. Falhas reproduzidas antes das correções e testes aprovados depois. Revisão final independente aprovou o delta, sem bloqueios.
