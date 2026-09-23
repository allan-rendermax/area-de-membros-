# Segunda rodada de carregamento da área de membros

## Objetivo e autorização

Reduzir espera tanto na entrada/recarregamento quanto ao navegar por produtos e aulas. O usuário confirmou os dois sintomas e pediu writing-plans, subagent-driven-development, paralelismo quando independente, execução sem perguntas, aprovação autônoma do plano e validação frontend com agent-browser da Vercel. O design e o plano serão revisados e aprovados pelo agente dentro dessa autorização. Preservar visual, conteúdo e regras de acesso.

## Evidência e limites

Baseline de código: 2f89ff1. Os 479 testes existentes passam. Em três GETs públicos de /arquitetura/entrar, tempo até primeiro byte: 1,296 s, 0,643 s, 0,401 s; isso não mede renderização, imagens ou navegação autenticada. Vercel inspect confirmou execução iad1. Não há evidência ainda sobre a região do banco; não escolher outra região por suposição. A rodada anterior usou backend sintético, portanto seus ganhos não provam a latência real.

O código bloqueia o layout/login em getStoreBySlug a cada requisição, embora Store contenha apenas metadados públicos. listModulesWithItems consulta módulos e depois itens em duas viagens sequenciais. ItemPage aguarda registro de acesso antes de consultar irmãos, embora ambas operações sejam independentes após autorizar. Há loading.tsx genérico da vitrine, sem uma tela específica de espera para aula/produto.

## Escolha

Implementar cache explícito de metadados públicos da loja e reduzir viagens/etapas de conteúdo. Fazer QA em build de produção com backend sintético determinístico, comparando o mesmo dataset antes/depois, e observar a entrada pública real separadamente. Não migrar o app inteiro para Cache Components: a documentação instalada admite unstable_cache em projetos sem cacheComponents, enquanto a migração ampla alteraria rotas dinâmicas e seria desproporcional. Não cachear catálogo, pois publicação e URLs privadas fazem parte do controle de conteúdo. Não mexer na região sem confirmar colocalização.

## Desenho

### Cache público

Manter a interface getStoreBySlug(slug): Promise<Store|null>, com unstable_cache, keyParts ['public-store-by-slug-v1'], tag compartilhada 'public-stores' e revalidate 300 segundos. O slug é argumento e separa entradas. Erros do banco propagam e não viram null. Store nulo pode ser cacheado: criação e renomeação expiram toda a tag, incluindo slugs antigos/novos e buscas negativas. getStoreById, listStores e todas as verificações de aluno/pedidos/permissões permanecem frescas. React cache em getStore continua deduplicando dentro de cada render.

Após saveStore concluir na Server Action salvarLoja, usar updateTag('public-stores') antes de revalidatePath/redirect. A invalidação não ocorre para gravação que falhou. Alterações diretas fora do painel dependem do TTL de 300 segundos e revalidação; documentar esse limite. Não usar cache de HTML de páginas autenticadas.

### Consultas e abertura

listModulesWithItems passa a obter modules com relação items numa única requisição, preservando interface e ordenação por sort_order, created_at nos dois níveis. publishedOnly filtra módulos e itens no banco; manter filtragem defensiva em memória compatível com o comportamento atual. A relação deve preservar módulos vazios e o modo admin com rascunhos. Não obter conteúdo antes da autorização da rota.

Em ItemPage, depois de todas as validações, executar listPublishedItemsInModule e recordItemAccess (apenas vídeo) com Promise.all. Ambas devem terminar antes de produzir HTML. Qualquer erro continua sendo propagado. Isso não habilita prefetch de itens, nem registra acesso antecipado.

Adicionar loading.tsx de produto e item usando um LessonSkeleton compartilhado: estrutura de cabeçalho, conteúdo e lateral que corresponda à aula, com estado acessível de carregamento. Não alterar a página pronta. A melhora perceptiva será distinguida da redução real de espera.

## Restrições globais

- Não alterar identidade visual, conteúdo, regras de acesso, pré-carregamento de itens ou registro obrigatório de acesso.
- Não cachear sessão, cliente, pedidos, ofertas, permissões, produtos, módulos, itens ou URLs privadas.
- Não modificar .env.local, chaves, dados reais, schema, DNS ou configurações remotas.
- Não adicionar dependências de produção nem habilitar cacheComponents.
- Usar o Next.js 16.3.5 instalado e ler sua documentação antes de escrever código.
- Preservar alterações preexistentes da pasta principal; trabalhar no worktree codex/carregamento-membros-2.
- TDD nas mudanças comportamentais; npm test, npx tsc --noEmit, npm run lint e npm run build antes de entregar.
- Frontend validado com agent-browser da Vercel, em desktop 1440x1000 e mobile 375x812.

## Validação

Testes de transporte da consulta relacional (uma requisição, filtro/ordem, módulos vazios, rascunhos e erros). Promessas controladas demonstram concorrência e que o HTML aguarda a gravação; não usar limiares de tempo frágeis em unitários. Cache: argumentos isolados, erros propagados, tag/TTL e invalidação após sucesso, nenhuma invalidação após falha; o cache real do Next é comprovado em build com contadores do backend, não apenas mocks. Login, vitrine, produto, vídeo, recursos, modal, voltar, bloqueio e reembolso entre requisições, ocultos/outra loja e edição/criação/rename de loja devem ser exercitados no fixture. Comparar tempos completos de resposta e navegação, com aquecimento, mesma latência e mesmo dataset; separar cold/warm. Não chamar resultado sintético de ganho em produção.

## Entrega

Código testado, revisão por tarefa e revisão final, relatório com medições e limitações. Integração local preservando alterações existentes; publicação em produção não é necessária para validar o código e não será presumida como feita. Região segue iad1 enquanto não houver evidência suficiente para mudança.

## Aprovação

Design revisado e aprovado autonomamente em 23/09/2026 conforme instrução explícita do usuário. Custo das decisões reversíveis: reverter os commits se a estratégia não trouxer ganho no ambiente real. A medição final determina o ganho reportado, sem percentual prometido antecipadamente.
