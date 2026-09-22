# Carregamento da área de membros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Reduzir consultas, etapas de espera e transferência de imagens nas rotas do aluno.

**Architecture:** Separar permissão de catálogo; iniciar leituras independentes juntas; aproveitar relações existentes para contexto de item. Usar imagens responsivas com fallback compatível e remover refetch no fechamento do modal.

**Tech Stack:** Next.js 16.3.5, React 19, Supabase JS/PostgREST, Vitest, agent-browser 0.38.1, Windows PowerShell.

**Spec:** docs/superpowers/specs/2026-09-22-carregamento-membros-design.md

## Global Constraints

- Não alterar .env.local, chaves, variáveis da Vercel, DNS, Resend ou dados remotos.
- Não alterar cores, tipografia, carrosséis, proporções ou regras de acesso existentes.
- Não adicionar cache persistente de sessão, cliente, pedidos ou permissões.
- Não adicionar migração nem dependência de produção; a migração de titularidade da sessão anterior continua pendente e independente.
- Não alterar riscos aceitos em docs/conferencia-gpt-cuspidora.md.
- TDD: observar falha da regressão antes de implementar e executar os testes após.
- Antes de concluir: npm test, npx tsc --noEmit, npm run lint, npm run build; commit e push em português.

## Review Focus

1. Reembolso ou bloqueio entre requisições deve remover acesso: regressões em Task 1, sem memoização persistente.
2. Pedido com store_id nulo e duas compras do mesmo código (uma paga, outra estornada) preservam acesso pela compra válida: Task 1.
3. Conteúdo de outra loja, oculto ou pai ausente nunca registra acesso nem expõe URL: Tasks 1 e 2.
4. URLs de imagem legadas, GIF/SVG e fontes externas continuam funcionando diretamente; next/image nunca recebe host não permitido: Task 3.
5. Fechar modal de link direto preserva outros parâmetros/hash e não refaz consultas; back/forward e Escape permanecem úteis: Task 3 e navegador.

## Preflight e baseline

- [x] Ler documentos obrigatórios e código relevante.
- [x] Criar worktree nativa `carregamento-membros`, branch `codex/carregamento-membros` a partir de `5fd77d0`.
- [x] `npm ci` e `npm test`: 248/248.
- [x] Build de baseline com DEFAULT_STORE_SLUG fictício em variável somente do processo (nenhum .env copiado).
- [x] Medir respostas com agent-browser/backend sintético, 100 ms por requisição Auth/REST; preservar baseline.json externamente.

## Task 1: Tirar catálogo da autorização e paralelizar leituras

**Files:**
- Modify: `src/lib/data/access.ts`, `src/lib/membros/session.ts`
- Modify: `src/app/[loja]/page.tsx`, `src/app/[loja]/produto/[slug]/page.tsx`, `src/app/[loja]/item/[id]/page.tsx`
- Create tests: `tests/membros/store-access.test.ts`, `tests/membros/session.test.ts`, `tests/membros/content-routes.test.ts`

**Interfaces:**
- Consome `CustomerRow`, `grantedProductIds`, `getProductLinks`, `listAllOrderRefsByEmail` existentes.
- Produz `loadGrantedProductIds(storeId: string, customer: CustomerRow): Promise<Set<string>>`.
- `loadStoreAccess(storeId: string, customerOrEmail: CustomerRow | string)` mantém retorno `{customer, products, granted}`; todos chamadores antigos com string continuam válidos.

- [x] **Step 1: Testes RED de permissão, chamadas e concorrência.** Mockar apenas I/O Supabase/rotas. Usar cliente normal/bloqueado, pedidos pagos/estornados em diferentes invocações. Exercitar função real, resultado e chamadas para provar que permissão não busca catálogo/cliente de novo. Esqueleto das asserções (fixtures declaradas no próprio arquivo):

```ts
expect(await loadGrantedProductIds('store-a', customer)).toEqual(new Set(['product-a']))
expect(listProducts).not.toHaveBeenCalled()
expect(findCustomerByEmail).not.toHaveBeenCalled()
orders.mockResolvedValueOnce([{ productCode: 'CODE', status: 'reembolsado' }])
expect(await loadGrantedProductIds('store-a', customer)).toEqual(new Set())
expect(await loadGrantedProductIds('store-a', { ...customer, blockedAt: '2026-09-22' })).toEqual(new Set())
```

Sessão: deferred promise de loja, confirmar que auth já iniciou antes de resolvê-la, depois conferir store/customer final. Testar visitante, loja inválida/ausente, cliente bloqueado com signOut, erros propagados. Rotas: chamar os componentes async com params e dependências controladas; verificar conteúdo/redirect/notFound e que recordItemAccess só ocorre após acesso permitido, e que os dois carregamentos iniciam antes de resolver um deles. Não comparar tempo de relógio em testes unitários.

- [x] **Step 2: Rodar `npm test -- tests/membros/store-access.test.ts tests/membros/session.test.ts tests/membros/content-routes.test.ts`.** Registrar falhas por helper ausente, catálogo indevido ou leitura serial, antes de implementar.
- [x] **Step 3: Implementar.** Helper novo:

```ts
export async function loadGrantedProductIds(storeId: string, customer: CustomerRow): Promise<Set<string>> {
  if (customer.blockedAt !== null) return new Set()
  const [links, orders] = await Promise.all([
    getProductLinks(storeId), listAllOrderRefsByEmail(customer.email),
  ])
  return grantedProductIds(orders, links, false)
}
```

No loader completo, resolver cliente a partir de string ou objeto, preservando consultas paralelas existentes e resultado. A vitrine passa `customer`, não `customer.email`. Não modificar loaders usados por e-mail/admin fora dessa compatibilidade. Na sessão, iniciar cliente Supabase/getUser e loja em Promise.all, sem usar getSession como substituto de verificação. Depois do resultado, manter redirecionamentos e consulta atual do cliente.

Produto: `const [product, granted] = await Promise.all([getProductBySlug(store.id, slug), loadGrantedProductIds(store.id, customer)])`; checar 404 primeiro, compra depois, módulos por último. Item: mesmo padrão com getItemWithContext; manter checagens de loja/publicação antes de acesso e registro. Não iniciar download nem registro especulativamente.

- [x] **Step 4:** testes focados GREEN e `npm test`; ler diff e registrar resultados no relatório da tarefa.
- [x] **Step 5:** commit `perf: reduz consultas e esperas na autorização dos alunos`.

## Task 2: Buscar contexto e irmãos de item com menos viagens ao banco

**Files:**
- Modify: `src/lib/data/products.ts`, `src/app/[loja]/item/[id]/page.tsx`
- Create: `tests/content/product-queries.test.ts`
- Modify: `tests/membros/content-routes.test.ts` (criado pela Task 1)

**Interfaces:**
- `getItemWithContext` mantém assinatura/retorno atuais.
- Produz `listPublishedItemsInModule(moduleId: string): Promise<Item[]>`.
- Consome grants e estrutura de rota da Task 1; não alterar estes contratos.

- [x] **Step 1:** Testes com transporte Supabase falso ou fluent builder que capture projeção e filtros, executando loaders reais. Contexto deve obter item/módulo/produto corretos em uma única chamada; pais null retornam null; erro é propagado. Itens irmãos devem conter apenas module_id requerido, is_published=true, ordenados por sort_order e created_at. Dados de dois módulos, um item oculto, módulo vazio. Exemplo de expectativas:

```ts
expect(await getItemWithContext(item.id)).toEqual({ item, module: parent, product })
expect(requests).toHaveLength(1)
expect(requests[0].searchParams.get('select')).toContain('modules(')
expect(requests[0].searchParams.get('select')).toContain('products(')
expect(await listPublishedItemsInModule(parent.id)).toEqual([first, second])
```

Teste rota de vídeo deve renderizar links Anterior/Próximo do módulo atual e não chamar listModulesWithItems. Ajustar mocks da Task 1 sem reduzir cobertura de isolamento e registro.

- [x] **Step 2:** `npm test -- tests/content/product-queries.test.ts tests/membros/content-routes.test.ts`; registrar RED.
- [x] **Step 3:** Consulta de contexto:

```ts
type DbItemContext = DbItem & { modules: (DbModule & { products: DbProduct | null }) | null }
const { data, error } = await createAdminClient().from('items')
  .select(`${ITEM_COLUMNS}, modules(${MODULE_COLUMNS}, products(${PRODUCT_COLUMNS}))`)
  .eq('id', itemId).maybeSingle()
if (error) throw error
const row = data as DbItemContext | null
if (!row?.modules?.products) return null
return { item: toItem(row), module: toModule(row.modules), product: toProduct(row.modules.products) }
```

Consulta de irmãos:

```ts
export async function listPublishedItemsInModule(moduleId: string): Promise<Item[]> {
  const { data, error } = await createAdminClient().from('items').select(ITEM_COLUMNS)
    .eq('module_id', moduleId).eq('is_published', true).order('sort_order').order('created_at')
  if (error) throw error
  return (data as DbItem[]).map(toItem)
}
```

Na rota vídeo substituir carregamento de todos os módulos por `const siblings = await listPublishedItemsInModule(ctx.module.id)`. Continuar aguardando recordItemAccess antes do redirect/HTML. listModulesWithItems permanece disponível para produto/admin sem mudanças.

- [x] **Step 4:** testes focados GREEN e `npm test`; relatório com RED/GREEN/diff.
- [x] **Step 5:** commit `perf: abre conteúdos com menos consultas ao banco`.

## Task 3: Otimizar capas e eliminar recarga ao fechar modal

**Files:**
- Create: `src/lib/content/image.ts`, `src/components/membros/content-image.tsx`
- Modify: `next.config.ts`, `src/components/membros/auto-cover.tsx`, `src/components/membros/hero.tsx`, `src/components/membros/locked-poster.tsx`
- Modify: `src/proxy.ts`; Test: `tests/auth/image-paths.test.ts` — excluir também extensão AVIF do matcher de assets públicos, como JPG/PNG/WebP existentes.
- Modify: `src/app/[loja]/produto/[slug]/page.tsx`, `src/app/[loja]/entrar/page.tsx`
- Create: `tests/content/image.test.ts`, `tests/membros/content-image.test.ts`, `tests/membros/locked-poster.test.ts`

**Interfaces:**
- `isOptimizableImage(src: string): boolean` e padrão compartilhado/configuração correspondente.
- `ContentImage({src, sizes, eager?, className?})`, alt vazio decorativo, fill quando otimizado; imagem nativa preserva h-full w-full/object-cover por className.
- AutoCover aceita `eager?: boolean`, `sizes?: string`; mantém defaults visuais. Default sizes poster `(max-width: 639px) 40vw, (max-width: 767px) 26vw, (max-width: 1023px) 20vw, 15vw`, banner `100vw`, episode `(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw` (seguro também para carrossel).

- [x] **Step 1:** RED para policy e HTML real renderizado (ReactDOMServer; mocks só se hooks exigirem). Verificar srcset/sizes no Next Image real e eager/high nas imagens principais; lazy e async nas demais, fallback gradiente sem URL. Hosts externos, http, bucket diferente, query/fragmento/credencial/porta, SVG/GIF devem usar img original sem otimização. Exemplo:

```ts
expect(isOptimizableImage('https://project.supabase.co/storage/v1/object/public/covers/a.jpg')).toBe(true)
expect(isOptimizableImage('https://project.supabase.co/storage/v1/object/sign/covers/a.jpg?token=x')).toBe(false)
expect(isOptimizableImage('/covers/a.png')).toBe(true)
expect(isOptimizableImage('//example.com/a.png')).toBe(false)
expect(isOptimizableImage('https://example.com/a.jpg')).toBe(false)
```

Teste modal com hooks/objeto history controlados: invocar fechamento, observar somente replaceState com URL que preserva outro parâmetro/hash; router.replace não deve ser chamado. O teste precisa acionar a função real do componente (não uma réplica da lógica). Testar sem comprar (nenhuma alteração de URL), Escape e clique/fechamento quando possível; navegador cobre interação/histórico reais.

Teste de matcher real com `unstable_doesMiddlewareMatch` (nome ainda exportado pelo pacote 16.3.5, apesar de a documentação usar doesProxyMatch) de `next/experimental/testing/server`: `/covers/a.avif` e `/covers/a.jpg` não executam proxy; `/arquitetura/produto/atlas` e `/admin/produtos` continuam executando. Isso evita tratar uma imagem AVIF local como rota de loja. Conferir documentação local `03-file-conventions/proxy.md`.

- [x] **Step 2:** `npm test -- tests/content/image.test.ts tests/membros/content-image.test.ts tests/membros/locked-poster.test.ts`; registrar RED.
- [x] **Step 3:** Implementar policy raster sem expor env. Remote pattern exato para protocol https, hostname `*.supabase.co`, port vazio, pathname `/storage/v1/object/public/covers/**`, search vazio. URLs não elegíveis usam img direto, inclusive GIF/SVG. Não habilitar dangerouslyAllowSVG/localIP. Local elegível é caminho iniciado com /, não //, com extensão raster minúscula e sem query/hash/backslash. Extensão local maiúscula mantém imagem nativa, pois o matcher público usa lowercase. Porta HTTPS explícita, inclusive :443, não é elegível. Next Image `fill sizes={sizes} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined}`; não usar priority deprecated nem misturar preload com loading/fetchPriority. Aspectos/estilos existentes permanecem.

Hero/banner produto passam eager=true. Backdrop de login usa ContentImage eager com sizes `100vw` mobile e `(min-width: 1280px) calc(100vw - 34rem), (min-width: 1024px) calc(100vw - 30rem), 100vw` no painel desktop; logos sem mudanças. Para evitar download de tamanhos diferentes dos dois fundos ocultos por CSS, considerar mesmo sizes correto por viewport nos dois Backdrops. Fechamento do modal: remover useRouter e trocar router.replace por `window.history.replaceState(null, '', url)`; usar integração nativa do Next e preservar hash/query.

No matcher estático em `src/proxy.ts`, acrescentar `avif` à lista `svg|png|jpg|jpeg|gif|webp`; manter todas as demais condições exatamente.

- [x] **Step 4:** testes focados GREEN e `npm test`; relatório RED/GREEN.
- [x] **Step 5:** commit `perf: entrega capas responsivas e evita recarregar a vitrine ao fechar detalhes`.

## Verificação integrada e entrega

- [x] Revisão independente por tarefa; correções voltam ao implementador e são reavaliadas.
- [x] Repetir baseline com backend idêntico (100 ms por Auth/REST), mesmo navegador e três amostras aquecidas; registrar contagem de consultas e tempos completos.
- [ ] agent-browser: 375×812 / 1440×1000, login/vitrine/produto/arquivo/vídeo, prev/next, isolamento/publicação, bloqueio/reembolso entre navegações, modal/URL/histórico, ausência de URLs privadas no HTML, imagens/overflow/erros. Fixture raster local demonstra srcset/bytes; imagens externas continuam acessíveis por fallback.
- [ ] Rodar `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; documentar saídas, avisos anteriores e limites da simulação.
- [ ] Revisão final do conjunto no modelo mais capaz; resolver achados conforme SDD.
- [ ] Escrever `docs/status-carregamento-2026-09-22.md`, integrar em main sem sobrescrever trabalho alheio, commit/push em português e confirmar árvore limpa/sincronizada.
