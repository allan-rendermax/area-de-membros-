# Verificação da jornada — 25/09/2026

## Escopo
Preservados o visual aprovado e o acesso direto capa → conteúdo. Trabalho isolado na branch `codex/revisao-jornada-admin`, base `fd69a52`, sem sobrescrever alterações locais no checkout original.

## Evidência por entrega
- T1: mutações vinculadas ao produto em transação; testes SQL reais em PGlite, IDs cruzados, rollback, bordas e ACL. Revisão independente sem falha funcional.
- T2: prontidão compartilhada por admin/importador, fronts novos usam versões, complementares usam seções, reimportações mantêm configuração existente. Bloqueio de novo nível vazio e publicação sem material; legados continuam editáveis com aviso. Ofertas novas exigem produto publicado.
- T3: download agenda histórico após autorização/assinatura; render de vídeo não grava histórico, componente registra visita real validada no servidor. Testes de histórico rejeitado/pendente, preview, refresh e acesso negado.
- T5: simulações Básico/Completo/sem compra exigem admin, excluem rascunhos, preservam contexto nas rotas e não gravam progresso/histórico. Editorial mantém acesso aos rascunhos.
- T7: Continuar usa último material autorizado por produto, com consulta em lote e fallback seguro.

## Migração
`20260926000000_scope_item_mutations` aplicada em produção em transação pelo SQL Editor; confirmada na tabela `supabase_migrations.schema_migrations`. Operação criou funções e registrou a migração; nenhum material foi excluído/reordenado para testar.

## Configuração comercial
Inventário somente leitura em `catalogo.md`. Atlas publicado tem materiais Básico e Completo, mas checkout/upgrade/suporte estão ausentes. Nenhum destino inventado nem conteúdo do catálogo alterado. Outros três produtos ainda são rascunhos sem materiais.

## Resultados consolidados
- Suite completa: `npm test -- --maxWorkers=2`, 118 arquivos / 987 testes passaram. Primeira rodada com paralelismo padrão e builds simultâneos atingiu timeout de 5s em três fixtures PGlite; repetição com dois workers passou sem alterar timeouts ou asserções.
- `npx eslint src tests --quiet`: passou.
- `npm run build -- --webpack`: passou (compilação, TypeScript, prerender). Webpack usado no ambiente local com node_modules compartilhado por junction; configuração de produção não alterada.
- Revisão independente T1–T7: nenhum bloqueador confirmado. Hipótese de reset após redirect foi retirada pelo revisor após conferir o comportamento do Next local; confirmação saved/limpeza dos formulários pequenos ficou explícita e testada.
- T4/T6: quatro imagens PNG válidas de 1.600.000 bytes enviadas separadamente pelo navegador. Falha sintética no terceiro upload manteve textos e imagens anteriores; retry funcionou. Slug duplicado manteve rascunho; correção salvou e limpou estado de alterações. Remoção da imagem de upgrade persistiu (capa/banner/modal mantidos).
- Prévia comercial mostrou título/CTA/texto editados sem salvar; nenhum href de checkout na prévia. Texto longo (~5 mil caracteres) coube em modal rolável; Tab alcançou fechar, Escape fechou e devolveu foco ao acionador.
- Mobile390: largura do conteúdo375px com scrollbar, sem overflow; resumo Conteúdos44px de altura de toque. Modal390px de largura, altura máxima759px na viewport844px; rolagem interna para texto longo. Tablet768: conteúdo753px, sem overflow. Desktop1440 também conferido no editor.
- Simulação no browser: Básico mostrou materiais próprios+upgrade; troca do seletor exibiu só Completo. Rotas preservam modo; progresso desabilitado. Conta Básico real da fixture retomou item31 na prateleira Continuar; link direto ao Completo redirecionou com mensagem de bloqueio.
- Migração: conferência SQL confirmou security invoker e execução=false para anon/authenticated, true para service_role nas duas funções.
- Medição antes/depois em benchmark.md: 220amostras, sem extrapolar fixture para produção. Não houve medição de LCP/CLS/INP/rede móvel e nenhuma otimização especulativa de cache/prefetch foi introduzida.

## Limites e operação
- O histórico existente usa ON DELETE CASCADE. Se o único item visitado for excluído, Continuar deixa de ter registro desse produto; capas normais permanecem. Visitas existentes revogadas/ocultas/inválidas usam fallback autorizado.
- Limpeza de uploads abandonados está documentada e é manual/revisável; nenhum arquivo removido automaticamente.
- Checkout/upgrade/suporte reais continuam pendentes no Atlas. Nenhuma compra real foi feita para validar.
- Conta Completo real da fixture mostrou apenas materiais Complete, sem upgrade. Conta sem produto abriu capas bloqueadas e modal; clique no CTA abriu `/reference?checkout=aluno` em nova aba (destino local fictício). Nenhuma transação realizada.
- Publicação e confirmação de implantação: registrar após deploy.
