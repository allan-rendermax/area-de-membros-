# Jornada do aluno e administração — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir inconsistências de entrega, configuração e navegação, preservando a identidade e a tela de conteúdo aprovadas.

**Architecture:** Reutilizar a regra central de acesso e componentes existentes. Separar validação de prontidão, contexto de simulação, upload de imagens e gravação de histórico das telas que os consomem. Não criar outro funil de páginas nem cache compartilhado de permissões.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, Supabase, Vitest/happy-dom, Vercel. Consultar guias locais de Next antes de implementar APIs.

**Spec:** `docs/superpowers/specs/2026-09-25-revisao-jornada-e-admin.md` — contém achados A1–A10, evidências, limites e direção de UI.

## Global Constraints

- Manter a identidade dark, laranja e amarela da Arquitetura e a composição aprovada da página de conteúdo.
- Capa liberada abre diretamente a tela de conteúdo. Não recriar uma página intermediária de download.
- Em versões: Completo vê somente Completo; Básico vê Básico e uma oportunidade de upgrade.
- Em seções: preservar organização de packs, orderbumps e upsells e o acesso cumulativo existente.
- Simulação é exclusiva de administrador, sem gerar compras, progresso ou histórico.
- Checkout, suporte, texto e imagens reais não devem ser inventados.
- Preservar arquivos locais não relacionados. Não executar exclusões ou compras em produção para validar.

## Review Focus

1. Oferta Completo em produto com só Básico deve apontar configuração incompleta, sem ampliar acesso (T2).
2. Quatro imagens válidas não podem exceder o corpo do salvar; falha parcial mantém rascunho (T4).
3. Histórico lento/indisponível não pode atrasar autorização já concluída e entrega; render/prefetch não equivale a consumo (T3).
4. URLs de simulação copiadas por aluno nunca concedem privilégios; rascunhos não aparecem em simulação realista (T5).
5. Último material removido/revogado precisa de fallback autorizado; nenhuma retomada expõe outro nível (T7).

## Sequência e dependências

| Fase | Entregas | Dependências | Esforço relativo |
|---|---|---|---|
| 1 | T1 integridade de ações; T2 paridade de cadastro/prontidão | Independentes | Médio + grande |
| 2 | T3 histórico resiliente | Independente de T1/T2 | Médio |
| 3 | T4 salvamento e upload; T5 simulação | T5 usa contratos de acesso de T2 | Grande + médio |
| 4 | T6 modais/editor/mobile; T7 retomada | T6 usa T4/T5; T7 usa T3 | Médio + médio |
| 5 | T8 medição e regressão; T9 catálogo/publicação | Após tarefas correspondentes | Médio |

“Esforço” é comparação entre tarefas, não prazo contratado. Executar por entregas revisáveis; não esperar todo o pacote para corrigir uma falha de entrega.

### T1 — Vincular mutações ao produto autorizado (A6)

**Files:** modificar `src/app/admin/(painel)/produtos/actions.ts`, `src/lib/data/products-admin.ts`; testes `tests/admin/store-context.test.ts`; criar `tests/admin/item-mutation-scope.test.ts`. Se usar RPC atômica, criar `supabase/migrations/20260926000000_scope_item_mutations.sql` após conferir versão disponível.

**Interfaces:** `deleteItem(id: string, productId: string): Promise<void>`; `moveItem(id: string, moduleId: string, productId: string, direction: 'up' | 'down'): Promise<void>`. Produto deve vir da checagem server-side, nunca ser considerado confiável só por existir no formulário.

- [ ] Adicionar teste de IDs cruzados; ambos os inválidos devem terminar antes de qualquer delete/update. Exemplo de contrato com fixture SQL:
  ```ts
  await expect(deleteItem(itemB.id, productA.id)).rejects.toThrow('Item inválido para este produto.')
  await expect(moveItem(itemB.id, moduleB.id, productA.id, 'up')).rejects.toThrow()
  expect(await readItems(productB.id)).toEqual(beforeB)
  ```
  No teste, `readItems(productId)` consulta os itens ligados aos módulos do produto, ordenados por ID; `beforeB` é o snapshot criado antes da chamada. Executar em banco efêmero, com mesmos e diferentes store_id.
- [ ] Rodar `npx vitest run tests/admin/item-mutation-scope.test.ts tests/admin/store-context.test.ts` e confirmar falha da nova proteção no código atual.
- [ ] Fazer a mutação condicionar item → módulo → produto na mesma operação SQL; reordenação deve abortar se item não pertencer ao módulo. RPC que use privilégio elevado deve ficar sem execução pública e ser chamada apenas pelo cliente administrativo. Não adicionar concessão pública como atalho.
  ```sql
  delete from public.items i
  using public.modules m
  where i.id = p_item_id and i.module_id = m.id and m.product_id = p_product_id;
  ```
  Conferir linhas afetadas e rejeitar zero. Para mover, conferir a mesma relação antes de renumerar dentro da transação.
- [ ] Validar alvo ausente, item fora do módulo, mesma/outra loja, mover primeiro/último e fluxo válido. Confirmar zero mutações no caso inválido.
- [ ] Commit sugerido: `fix: scope item mutations to authorized product`.

### T2 — Unificar versões e impedir entrega vazia (A3, A4)

**Files:** `scripts/lib/cadastro-plano.mjs`, `scripts/lib/cadastro-executor.mjs`, `src/lib/admin/forms.ts`, `src/app/admin/(painel)/produtos/actions.ts`, `src/app/admin/(painel)/produtos/content-editor.tsx`, `src/app/admin/(painel)/ofertas/offer-form.tsx`, `src/app/admin/(painel)/ofertas/actions.ts`. Criar `src/lib/access/product-readiness.ts`; testes `tests/cadastro/niveis.test.ts`, `tests/cadastro/executor.test.ts`, `tests/access/product-readiness.test.ts`, `tests/admin/store-context.test.ts`.

**Interfaces:** `assessProductReadiness({ mode, modules, offeredLevels }): { emptyLevels: AccessLevel[] }`, usando itens publicados com URLs válidas e módulos publicados. Não exige que todos os produtos possuam duas versões: exige material para os níveis que realmente serão comercializados.

- [ ] Fixar matriz com casos explícitos, incluindo arquivo/link/vídeo válidos, rascunhos e URLs inválidas:
  ```ts
  expect(assessProductReadiness({mode:'versions', modules:[basicModule], offeredLevels:['complete']}).emptyLevels).toEqual(['complete'])
  expect(assessProductReadiness({mode:'sections', modules:[basicModule], offeredLevels:['complete']}).emptyLevels).toEqual([])
  ```
  `basicModule` é fixture publicada com requiredLevel basic e um arquivo HTTP válido. Acrescentar Complete-only, ambas e zero conteúdo.
- [ ] Aceitar na ficha `organizacao: versions|sections|auto`. Novo front auto usa versions; novo complementar auto usa sections; reimportação sem valor preserva o modo salvo e informa essa escolha no dry-run. Gravar `content_mode` explicitamente no insert.
  ```js
  const mode = ficha.organizacao === 'auto' || !ficha.organizacao
    ? product?.content_mode ?? (ficha.tag === 'front' ? 'versions' : 'sections')
    : ficha.organizacao
  data.content_mode = mode
  ```
- [ ] Inserir prontidão no dry-run, publicação e vínculo/alteração de oferta. Produto rascunho e montagem de seções continuam permitidos. Bloquear nova oferta/publicação que prometa nível vazio, explicando qual nível precisa de material; mostrar aviso para configurações legadas já existentes, sem revogar compras automaticamente.
- [ ] Ao trocar sections→versions, apresentar contagens por nível e aviso de que Completo deve ser autocontido. Não copiar nem mover material automaticamente. Ocultar último material de nível comercializado requer aviso e fluxo deliberado de retirada, em vez de bloqueio que impossibilite retirar material problemático.
- [ ] Rodar `npx vitest run tests/cadastro tests/access/product-readiness.test.ts tests/access/product-content.test.ts tests/admin/store-context.test.ts`; conferir atualização idempotente de produto já existente.
- [ ] Atualizar `docs/como-cadastrar-produto.md` sem sobrescrever edições locais; commit `fix: align product versions across admin and imports`.

### T3 — Retirar histórico do caminho crítico (A1)

**Files:** `src/components/membros/item-content.tsx`, `src/app/[loja]/item/[id]/abrir/route.ts`, `src/lib/data/item-access.ts`; criar `src/components/membros/record-item-visit.tsx`, `src/app/[loja]/historico/actions.ts`; testes `tests/membros/content-routes.test.ts`, `tests/membros/resource-open.test.ts`, `tests/membros/item-visit.test.ts`.

**Interfaces:** manter `recordItemAccess(entry)` como persistência; acrescentar wrapper que captura falhas para observabilidade. `recordVisit(storeSlug, itemId)` revalida sessão, produto, nível e publicação, sem confiar em IDs de cliente recebidos. Vídeo registra visita real uma vez por navegação, não execução de Server Component.

- [ ] Trocar os testes que atualmente exigem bloqueio por testes de entrega com falha de histórico; autorização negada continua sem assinatura nem registro.
  ```ts
  mocks.recordItemAccess.mockRejectedValue(new Error('history unavailable'))
  const response = await GET(request, routeContext)
  expect(response.status).toBeGreaterThanOrEqual(300)
  expect(response.status).toBeLessThan(400)
  expect(response.headers.get('location')).toBe(expectedAuthorizedUrl)
  ```
  Reutilizar fixtures de `resource-open.test.ts`. Incluir promessa pendente para provar que a resposta não aguarda histórico.
- [ ] Ler `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`. Em `/abrir`, só agendar após validar destino, acesso e assinatura:
  ```ts
  after(async () => {
    try { await recordItemAccess(entry) }
    catch { console.error('item_access_write_failed', { itemId: entry.itemId }) }
  })
  return Response.redirect(destination)
  ```
  Não registrar tokens/URLs assinadas/e-mail. Falha de autorização ou assinatura continua bloqueante.
- [ ] Remover INSERT de `renderItemContent`. Registrar visita ao vídeo em componente client pequeno ao efetivar navegação, com deduplicação por visita e validação server-side; refresh de progresso não gera nova visita. Prévia e simulação não instanciam esse registrador.
- [ ] Rodar testes de download/vídeo, refresh, remount, preview, rejeição e ordem auth→assinatura→resposta. Verificar em runtime Vercel que after conclui após redirect.
- [ ] Commit `fix: keep access history outside material delivery`.

### T4 — Upload individual e salvamento recuperável (A2, A9)

**Files:** `src/app/admin/(painel)/produtos/product-form.tsx`, `locked-product-fields.tsx`, `actions.ts`, `content-editor.tsx`, `item-fields.tsx`; `src/lib/data/products-admin.ts`, `src/lib/admin/forms.ts`; criar `src/components/admin/product-image-input.tsx` e `src/lib/admin/product-form-state.ts`. Testes `tests/admin/upload.test.ts`, `tests/admin/item-upload-ui.test.ts`, `tests/admin/product-form-state.test.ts`.

**Interfaces:** `ProductFormState = { status: 'idle'|'error'|'saved'; fieldErrors: Record<string,string>; message: string|null }`. `ProductImageInput` recebe slot cover/banner/purchase/upgrade, URL atual e callback de URL validada. Reutilizar padrão de ticket/envio/progresso do upload de materiais, adaptando bucket e validação de imagem.

- [ ] Criar teste com quatro arquivos de 1,6 MB: uploads individuais permitidos e ação final sem File binário. Testar inválida >2 MB e falha no terceiro upload sem perder as duas URLs anteriores nem os campos digitados.
  ```ts
  expect([...finalForm.values()].some(value => value instanceof File)).toBe(false)
  expect(finalForm.get('purchase_image_url')).toBe(uploadedPurchaseUrl)
  ```
- [ ] Preparar tickets somente após requireAdmin e contexto de loja/produto. Limitar bucket, tamanho, MIME e prefixo do objeto; validar referência de upload antes de salvar. Não aceitar URL externa arbitrária como se fosse comprovante de upload próprio.
- [ ] Enviar cada imagem diretamente, exibindo progresso/erro/tentar novamente e miniatura. Manter limite individual 2 MB e corpo da ação abaixo de 4,5 MB; não aumentar o limite como única correção.
- [ ] Converter formulário em shell client com `useActionState` e retorno estruturado na falha. Preservar campos e URLs temporárias; limpar dirty somente após sucesso. Erros de slug/URL/tamanho aparecem junto ao controle e no resumo; não usar redirect em erro.
  ```ts
  if (validationError) return {status:'error', fieldErrors:{slug:validationError}, message:'Revise o endereço do produto.'}
  ```
- [ ] Tornar salvamento indisponível enquanto upload/salvamento estiver pendente, com “Enviando imagem…”/“Salvando…”. Definir precedência: novo upload válido vence remoção; remoção sem upload limpa URL. Reusar estado nos pequenos formulários de seção/material sem refazer o editor inteiro.
- [ ] Testar slug duplicado, perda de conexão, troca de loja e duplo clique em fixture; rotular especificamente Capa e Banner. Conferir resíduos de uploads órfãos e prever limpeza limitada a objetos temporários não referenciados, sem excluir arquivos existentes automaticamente.
- [ ] Rodar testes admin indicados e verificar quatro uploads em preview de implantação; commit `fix: preserve product drafts and upload images individually`.

### T5 — Simular experiência Básico/Completo/sem compra (A5)

**Files:** `src/lib/membros/preview.ts`, `src/lib/membros/paths.ts`, `src/lib/access/product-content.ts`, `src/app/[loja]/page.tsx`, `produto/[slug]/page.tsx`, `item/[id]/page.tsx`, `item/[id]/abrir/route.ts`, `src/components/membros/store-header.tsx`; testes `tests/membros/admin-preview.test.ts`, `tests/access/product-content.test.ts`.

**Interfaces:** `PreviewMode = 'editorial'|'basic'|'complete'|'locked'`. `previa=1` sem outro parâmetro mantém editorial. `simular=basic|complete|locked` só tem efeito após requireStorePreview; não confiar no parâmetro em sessão normal.

- [ ] Criar matriz de teste:
  ```ts
  const cases = [
    ['editorial', ['basic','complete'], false],
    ['basic', ['basic'], true],
    ['complete', ['complete'], false],
    ['locked', [], false],
  ] as const
  ```
  Terceiro valor indica upgrade visível; locked mostra compra bloqueada. Aplicar tanto a versions quanto a sections com expectativas próprias.
- [ ] Separar `isAdminPreview` (sem gravação) de `includeDrafts` (somente editorial) e de `bypassAccess` (somente editorial). Simulação usa publicação/nível reais; não reutilizar boolean preview para todas essas finalidades.
- [ ] Preservar modo nas URLs de capa/sidebar/anterior/próximo/retorno. No header mostrar “Prévia editorial” ou “Simulação: Básico”, com seletor de contexto exclusivo do admin.
- [ ] Testar aluno usando parâmetros, outra loja, rascunhos, URL de download bloqueada, alteração de modo e ausência absoluta de gravações/assinaturas indevidas.
- [ ] Rodar `npx vitest run tests/membros/admin-preview.test.ts tests/access/product-content.test.ts tests/membros/resource-open.test.ts`; conferir quatro modos no browser; commit `feat: add realistic member access simulations`.

### T6 — Ajustar modais, editor e detalhes mobile (A7, A8 e UX)

**Files:** `product-form.tsx`, `locked-product-fields.tsx`, `src/components/membros/product-upgrade.tsx`, `locked-poster.tsx`, `lesson-sidebar.tsx`, `src/lib/admin/forms.ts`; criar `src/app/admin/(painel)/produtos/upgrade-fields.tsx`. Testes `tests/admin/forms.test.ts`, `tests/admin/student-checkout-preview.test.ts`, `tests/membros/locked-poster.test.ts` e teste de upgrade existente/localizado na execução.

**Interfaces:** `UpgradeFields` recebe draft do produto e contexto da loja; ambos os modais recebem dados do rascunho para visualização. `ProductUpgrade` ganha `previewOnly?: boolean` para omitir “Já paguei” na prévia administrativa. Não confundir visualização de rascunho com publicação.

- [ ] Corrigir tema de upgrade por MemberTheme, passando suporte e nome real da seção; manter dark e laranja/amarelo da Arquitetura. Testar também loja com outro tema.
- [ ] Implementar remoção explícita de imagem e teste de persistência:
  ```ts
  upgradeImageUrl: checked(form, 'remove_upgrade_image')
    ? null : optionalUrl(form, 'upgrade_image_url', 'Imagem de upgrade')
  ```
  Validar seleção simultânea com novo upload conforme T4.
- [ ] Agrupar formulário nos quatro blocos da spec; exibir estado comercial e “Salvar alterações” acessível sem sobrepor mobile. Não esconder erro dentro de acordeão fechado.
- [ ] Mostrar preview do rascunho, aviso “Prévia — alterações ainda não salvas” e rótulos de salvamento específicos. Não disparar checkout ou navegação de atualização de acesso ao usar controles internos da prévia.
- [ ] Reduzir padding/altura do resumo Conteúdos somente em mobile; manter área de toque pelo menos 44 px. Preservar título do produto, lista de materiais, ajuda e toolbar.
- [ ] Conferir 390/768/1440 px, teclado Tab/Shift+Tab/Escape, nomes longos, imagem ausente, texto de 5000 caracteres, CTA de 80 caracteres e reduced-motion. Controles de fechar/CTA devem continuar alcançáveis com rolagem; foto quadrada inteira, sem distorcer.
- [ ] Commit `fix: align commercial previews and streamline product editing`.

### T7 — Fazer “Continuar” retomar material autorizado (A10)

**Files:** `src/lib/data/item-access.ts`, `src/app/[loja]/page.tsx`; criar `src/lib/membros/resume-material.ts`; testes `tests/membros/resume-material.test.ts` e teste existente da home.

**Interfaces:** `RecentProductVisit = { productId: string; itemId: string; accessedAt: string }`; `resolveResumeItem(visits, accessibleItemIds): string|null` retorna primeiro item autorizado em ordem recente. A consulta de recentes deve transportar nível necessário e publicação ou usar conjunto autorizado preparado no servidor.

- [ ] Testar último item acessível, revogado, rascunho, removido, outra loja e vazio:
  ```ts
  expect(resolveResumeItem([{itemId:'complete-2'}, {itemId:'basic-1'}], new Set(['basic-1']))).toBe('basic-1')
  expect(resolveResumeItem([{itemId:'removed'}], new Set())).toBeNull()
  ```
  A função usa apenas itemId; a consulta chama por produto/cliente/loja e fornece lista ordenada.
- [ ] Alterar apenas a prateleira Continuar para usar `/item/<id>`. Capas normais continuam `/produto/<slug>`. Não apontar direto para URL privada ou externa na retomada.
- [ ] Em ausência de último item autorizado, usar rota normal do produto e deixar sua autorização atual resolver o acesso. Evitar consulta por card; fazer lote.
- [ ] Rodar testes da home/retomada/acesso e conferir browser com fixture tendo item 2 como último aberto; commit `fix: resume the last accessible material`.

### T8 — Medir desempenho e ampliar regressão real

**Files:** criar `docs/qa/jornada-2026-09-25/benchmark.md` e `docs/qa/jornada-2026-09-25/checklist.md`; modificar consultas/links apenas quando a medição justificar. Candidatos: `item-content.tsx`, `episode-card.tsx`, `lesson-toolbar.tsx`, `src/lib/membros/session.ts`, `src/lib/data/products.ts`.

- [ ] Medir build de produção antes/depois com fixture Básico/Completo, desktop e rede móvel. Fazer cinco navegações frias e cinco quentes por cenário: capa→conteúdo, sidebar→item e abrir arquivo público/privado. Registrar p50 e máximo; só calcular p95 com amostra ampliada suficiente, sem tratar cinco observações como percentil confiável.
- [ ] Registrar clique→feedback, clique→conteúdo, TTFB/RSC, consultas, bytes de imagens, LCP e CLS; separar tempo de auth e storage. Medições não devem usar duração da chamada de ferramenta como substituto.
- [ ] Depois de T3, avaliar prefetch por intenção e `useLinkStatus` seguindo os docs locais. Sem prefetch massivo em todos os cards nem cache global de autorização. Se não houver ganho mensurável, não alterar.
- [ ] Conferir independência de progresso versus módulos; iniciar leituras independentes cedo somente se não mudar a validação de acesso. Imagem externa só merece transformação nova se bytes/LCP mostrarem problema.
- [ ] Executar checklist de browser: voltar preserva prateleira/scroll; links diretos por nível; modal abrir/fechar/foco; upgrade/compra com checkout configurado; retorno pós-pagamento pendente/confirmado via fixture; timeout de histórico/progresso; mobile e teclado. Não efetuar compra real.
- [ ] Rodar `npm test`, `npx eslint src tests --quiet`, `npm run build` e guardar resultados. Novos testes devem falhar com bug reproduzido e passar após correção; evitar teste que apenas espelha classes CSS.
- [ ] Critérios: nenhuma regressão de acesso; nenhum overflow a 390 px; feedback visível ao navegar/salvar; histórico fora do tempo crítico; nenhuma afirmação de “mais rápido” sem comparativo.
- [ ] Commit de medições/testes e, se houver, otimização em commit separado com valores antes/depois.

### T9 — Conferir catálogo e publicar por fase

**Files:** criar `docs/qa/jornada-2026-09-25/catalogo.md`; atualizar documentação funcional pertinente. Não alterar arquivos de produtos em lote sem diff revisável.

- [ ] Inventariar fronts em versions, níveis de ofertas, materiais utilizáveis por nível, checkouts e suporte. Marcar Complete vazio, Basic vazio comercializado, link ausente e Complete possivelmente só extra.
- [ ] Para Atlas, solicitar ao responsável URLs reais de checkout/upgrade, texto opcional e mockup. Não inventar benefícios/desconto: usar apenas o que estiver configurado no checkout.
- [ ] Conferir se Completo contém o prometido sem depender do acesso ao Básico. Produtos migrados que só têm vídeos também entram na conferência; não modificar a migração histórica aplicada.
- [ ] Se houver nova migração, aplicar antes do código dependente e validar schema/histórico. Publicar somente commits da fase revisada, preservando alterações locais alheias.
- [ ] Validar implantação Ready, painel, aluno Básico/Completo/sem compra e downloads com fixture; não só prévia editorial. Guardar SHA, deployment, testes e limitações.
- [ ] Rollback de código por deploy anterior; não apagar dados/colunas para desfazer UI. Antes de qualquer alteração de catálogo, guardar snapshot específico e manter reversão documentada.

## Critério de conclusão do pacote

Concluído quando A1–A10 estão resolvidos ou explicitamente adiados, as regras aprovadas seguem intactas, o administrador configura e confere a venda sem ambiguidade e existe evidência de browser para os três perfis de comprador. Desempenho só é declarado melhor com medição. Configuração comercial faltante deve continuar listada como pendência operacional, não mascarada por botões sem destino.

## Fora do escopo

Redesign completo, novo player/LMS, nova plataforma de checkout, alteração da regra Completo→somente Completo, instalação de analytics de terceiros, auditoria completa de webhooks/e-mails, renomeação automática do acervo e migrações destrutivas.

## Revisão do plano

- [x] A1–A10 têm tarefa correspondente.
- [x] Cinco condições do Review Focus têm validação atribuída.
- [x] Melhorias comprovadas foram separadas de hipóteses de performance.
- [x] O layout rejeitado pelo usuário não é reintroduzido.
- [x] Preservada diferença entre prévia editorial e simulação realista.
- [x] Somente documentos produzidos nesta etapa; implementação aguarda decisão do usuário.

Recomenda-se execução com subagentes por tarefa e revisão independente, porque regras de acesso, publicação e cadastro precisam concordar sem misturar permissões com apresentação.


## Registro de execução
Implementação autorizada pelo usuário em 25/09/2026. T1–T7 executadas e revisadas. Evidências e limitações concretas em `docs/qa/jornada-2026-09-25/checklist.md`, `benchmark.md` e `catalogo.md`. T8 realizou benchmark HTTP com builds de produção locais; métricas visuais/rede móvel/Vercel não medidas e não alegadas. T9 inventário somente leitura, migração aplicada sem alteração de catálogo; destinos comerciais ausentes não foram inventados. O resultado preserva o layout aprovado e a diferença entre versões e seções.
