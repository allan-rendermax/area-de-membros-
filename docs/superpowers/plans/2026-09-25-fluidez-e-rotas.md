# Fluidez e rotas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reduzir trabalho duplicado ao abrir materiais, sobrepor consultas independentes e manter o acervo disponível se o histórico falhar.

**Architecture:** Extrair a renderização autorizada da tela de item para `renderItemContent`. A rota de produto entrega a mesma tela usando os módulos já consultados, sem redirecionamento para outra página. A rota de item conserva sua autorização e reutiliza esse renderer. Progresso, módulos e registro de vídeo iniciam juntos depois da autorização.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, Vitest.

**Spec:** Solicitação nesta conversa de revisar rotas, fluidez e velocidade, implementar e publicar. Preservar o layout e os nomes aprovados; não alterar permissões ou comportamento de downloads.

## Global Constraints
- Proibido cache global de autorização ou URLs privadas.
- Capa abre a mesma tela de conteúdo, sem uma página intermediária.
- Rotas diretas de item continuam válidas.
- Prévia conserva `previa=1`, não grava acesso nem progresso.
- Progresso pode falhar sem bloquear os materiais; consulta de autorização nunca é ignorada.
- Registro de acesso de vídeo mantém o contrato existente; arquivos/links só são registrados quando abertos.
- Não alterar conteúdo real durante testes de navegador.
- Medir trabalho eliminado e paralelismo com regressões determinísticas; não prometer porcentagem de ganho sem benchmark real.

## Review Focus
- Produto Básico com primeiro módulo restrito: escolher conteúdo autorizado e não revelar URLs privadas.
- Produto vazio/rascunho e item inválido: manter estado vazio ou 404, sem loop.
- Prévia versus aluno: preservar parâmetros e impedir gravações pela prévia.
- Histórico indisponível: manter catálogo e acesso, omitindo somente Continuar.
- Consultas lentas: módulos devem iniciar antes do progresso terminar, preservando falha de autorização.

### Task 1: Reutilizar a tela autorizada e corrigir a sequência de consultas
**Files:** `src/app/[loja]/item/[id]/page.tsx`, `src/app/[loja]/produto/[slug]/page.tsx`, novo `src/components/membros/item-content.tsx`, `tests/membros/content-routes.test.ts`.

**Interfaces:** `renderItemContent({ ctx, store, customer, level, preview, blocked, productModules? })` recebe contexto já autorizado, tipos de domínio existentes, e retorna Promise de JSX. Não é endpoint público. Módulos opcionais são reaproveitados somente dentro da mesma requisição.

- [x] Alterar testes da rota de produto para esperar HTML de conteúdo, zero redirects, uma chamada a sessão/permissão/módulos e zero getItemWithContext. Confirmar vídeo registrado uma vez e arquivo/link não registrados.
- [x] Adicionar teste com promise pendente em listCompletedItemIds: antes de resolvê-la, listModulesWithItems deve ter iniciado. Resolver ambas e verificar conteúdo.
- [x] Rodar `npx vitest run tests/membros/content-routes.test.ts`: esperado FAIL nas novas expectativas.
- [x] Extrair o bloco de carregamento/renderização da rota de item depois das verificações de acesso. Usar `Promise.all([Promise.allSettled([progressPromise]), modulesPromise, recordPromise])` para sobrepor I/O e capturar apenas falha opcional do progresso.
- [x] Na rota de produto, chamar o renderer com primeiro item autorizado, seu módulo e `publishedModules` previamente carregados. Conservar estado vazio e upgrade quando não houver item autorizado.
- [x] Rodar os testes focados: esperado PASS, incluindo níveis de acesso, vídeos inválidos e rascunhos.

### Task 2: Retorno ao acervo e tolerância a falha de histórico
**Files:** `src/app/[loja]/page.tsx`, `src/components/membros/item-content.tsx`, `src/app/[loja]/produto/[slug]/page.tsx`, `tests/membros/content-routes.test.ts`.

**Interfaces:** volta ao acervo usa `withPreview('/<loja>#materiais', preview)`; âncora única existe para todos os temas. `listRecentProductIds` continua retornando string[], com fallback local na vitrine.

- [x] Testar histórico rejeitado: produto autorizado deve continuar renderizando, sem carrossel Continuar. Testar href de retorno e âncora no tema genérico.
- [x] Rodar testes e observar falhas esperadas.
- [x] Usar `listRecentProductIds(...).catch(() => [])` somente para a consulta opcional; preservar falhas de loadStoreAccess.
- [x] Ajustar links de retorno para #materiais e dar id ao contêiner das prateleiras no tema genérico; manter a âncora existente em arquitetura. Marcar active="home" no cabeçalho da vitrine.
- [x] Rodar testes focados, suite inteira, build, ESLint e diff check no escopo: esperado PASS.

### Task 3: Revisão e publicação
**Files:** plano atual e anotação local em `docs/estado-atual.md`.

- [x] Revisor independente inspeciona diff e proteções enquanto o implementador conclui checks e prepara navegador.
- [x] Commit apenas mudanças desta tarefa; push e aguardar deployment Ready (publicação explicitamente autorizada).
- [x] No navegador autenticado, abrir capa e verificar tela final na URL do produto sem salto para /item; visitar link direto do item; testar retorno à seção de materiais, ajuda e Sobre. Prévia sem downloads/gravações reais.
- [x] Verificar desktop e mobile, erros de console e rotas sem autenticação. Reportar métricas estruturais e limites da medição.


## Validação da implementação
- Observadas dez falhas novas antes da implementação; 51 testes focados passaram após as mudanças.
- Suite completa: 811 testes em 102 arquivos. Build e ESLint aprovados.
- Revisão independente: sem bugs novos concretos ou bloqueios. Conferiu permissões, prévia, ordem das consultas e comportamento documentado do prefetch dinâmico com loading boundary.
- Ganho verificável: abertura pela capa evita o redirect produto → item e a segunda consulta de sessão/permissões/contexto/módulos. Conteúdo e progresso deixam de executar em sequência.
- Limite: não foi estabelecido benchmark de latência real de aluno antes/depois; os resultados não representam porcentagem de aceleração.
- Conferência e deployment registrados em docs/estado-atual.md ao concluir.

## Ajuste encontrado na conferência em produção
- O Next chegava ao hash antes da seção renderizada sob loading boundary. A URL ficava correta, mas o navegador não rolava até as capas.
- Adicionado ScrollToMaterials, executado uma vez ao montar a vitrine e somente quando hash é #materiais; rolagem instantânea respeita redução de movimento. Regressões cobrem navegação normal, prévia e entrada sem hash.
- Suite final após o ajuste: 814 testes em 103 arquivos; build e ESLint aprovados.
