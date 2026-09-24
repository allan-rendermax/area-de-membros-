# Cadastrador genérico — design
Data: 2026-09-24

## Objetivo e escopo
O dono organiza ficha, imagens e entregáveis em uma pasta e cadastra ou atualiza um produto publicado, vinculado ao código Payt. A compra continua usando o fluxo de ofertas existente. A proposta original está em docs/superpowers/specs/cadastro-proposta-original.txt.

## Alternativas e decisão
1. Script único copiando Atlas: menor início, mistura validação, rede e gravações.
2. Planejador puro + leitor local + executor Supabase + CLI: escolhido, permite validar todo lote antes de enviar e testar sem credenciais.
3. Importador dentro do admin: requer uploads e nova interface, fora do escopo.

## Regras globais
- Não alterar scripts/cadastro-atlas-patologias.mjs.
- Não aplicar migration em produção, não cadastrar produtos reais, não fazer push nem deploy.
- Nunca imprimir nem commitar segredos do .env.local.
- products.role: front | orderbump | upsell; default front, not null, check.
- Todos os produtos publicados não comprados permanecem bloqueados e visíveis.
- Orderbump e upsell têm a mesma prioridade, antes de front; depois sort_order; comprados e destaque preservam o comportamento existente.
- Nenhum item ou módulo ausente da pasta será apagado.
- Bucket arquivos e caminhos <slug>/...; execução repetida atualiza sem duplicar.

## Ficha e arquivos
produto.txt aceita comentários de linha # antes da descrição, BOM e CRLF. nome/id/tag obrigatórios; loja usa DEFAULT_STORE_SLUG se omitida, sem inventar loja. descricao ocupa tudo após sua chave. slug gerado sem acentos ou validado se explícito. id não aceita espaços. tag estrita; checkout HTTP(S) obrigatório para orderbump/upsell. destaque sim/nao (também não) default nao; ordem inteiro PostgreSQL default 0.
capa e banner jpg/png/webp opcionais; múltiplas opções para o mesmo papel são erro.
entregaveis contém arquivos soltos (Material) e pastas de módulo de um nível. Prefixo numérico indica ordem e sai do título de módulo/arquivo. Numerados precedem não numerados, estes em ordem alfabética pt-BR, desempate estável pelo nome. Subpastas mais profundas e links simbólicos são rejeitados com mensagem clara.
links.txt aceita Título | URL, ignora linhas vazias/comentários; URLs HTTP(S), YouTube/Vimeo por hostname confiável geram video; restantes link. Vai a Conteúdo online.
Colisões de título de módulos/itens ou de destino no storage são erro antes de enviar.

## Fluxo
CLI lê ambiente sem mostrar valores, escaneia todas as pastas, monta e valida todos os planos. --todos considera subpastas imediatas com produto.txt, lista ignoradas e erra se não encontrar produtos. Rejeita loja+slug repetido, Payt repetido e mesmo slug em lojas diferentes no mesmo lote (storage compartilha prefixo).
--simular imprime produto, módulos, itens, tamanhos, oferta e link, sem cliente Supabase/rede.
Execução real faz preflight de lojas, esquema role, ofertas e produtos antes de uploads. Código Payt vinculado a outra loja/produto é conflito, não sequestrar ofertas existentes nem remover vínculos. Slug igual em outra loja conflita no storage e deve ser recusado. Erros de consulta nunca são tratados como registro ausente.
Uploads upsert com MIME e URL ?download=<título>.<ext>. Produto por store_id+slug; módulo por título; item por título no módulo; oferta por código e vínculo offer_products. Atualizar ordem/publicação também em existentes. Relatar conteúdo extra do banco, sem apagar.
Falha de rede pode deixar gravações parciais: mensagem clara e reexecução idempotente para retomar, sem promessa de transação entre storage e banco.

## Interface e compatibilidade
Propagar role pelo tipo Product, DbProduct, queries, formulário e persistência. A action existente já usa o parser; demonstrar por teste que role atravessa a action, sem alteração cosmética obrigatória. Preservar prioridade também em buildTracks porque é o agrupamento exibido.
Migration deve ser aplicada antes de colocar a nova versão em produção.

## Validação
TDD de parser/plano, ordenação da vitrine, formulário, migration com PGlite quando viável e executor com fake Supabase que mantém estado. CLI em subprocesso com pastas temporárias para simulação e lote inválido. npm test, npm run lint, npm run build. QA frontend com Vercel agent-browser e fixtures locais, sem gravações remotas.
