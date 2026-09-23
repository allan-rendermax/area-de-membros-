# Carregamento real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir espera na entrada e navegação preservando visual e segurança da área de membros.

**Architecture:** Cache somente dos metadados públicos da loja, invalidado ao salvar no painel. Uma consulta relacional para módulos/itens e concorrência após autorização para registro/irmãos. Skeleton próprio para aula/produto, com medição em build real.

**Tech Stack:** Next.js 16.3.5, React 19, Supabase/PostgREST, Vitest, agent-browser 0.38.1.

**Spec:** docs/superpowers/specs/2026-09-23-carregamento-real-design.md

## Global Constraints

- Não alterar identidade visual, conteúdo, regras de acesso, pré-carregamento de itens ou registro obrigatório de acesso.
- Não cachear sessão, cliente, pedidos, ofertas, permissões, produtos, módulos, itens ou URLs privadas.
- Não modificar .env.local, chaves, dados reais, schema, DNS ou configurações remotas.
- Não adicionar dependências de produção nem habilitar cacheComponents.
- Usar o Next.js 16.3.5 instalado e ler sua documentação antes de escrever código.
- Preservar alterações preexistentes da pasta principal; trabalhar no worktree codex/carregamento-membros-2.
- TDD nas mudanças comportamentais; npm test, npx tsc --noEmit, npm run lint e npm run build antes de entregar.
- Frontend validado com agent-browser da Vercel, em desktop 1440x1000 e mobile 375x812.

## Review Focus

- Loja antes inexistente ou renomeada deve abandonar cache negativo/slug antigo imediatamente após salvar: tarefa 1 e QA.
- Falha do banco não pode se transformar em loja ausente nem invalidar cache como sucesso: tarefa 1.
- Módulo sem itens publicados e admin com rascunhos preservam semântica: tarefa 2.
- Reembolso/bloqueio/oculto/outra loja continuam impedindo conteúdo na próxima requisição: tarefa 2 e QA.
- Registro pendente ou falho não libera HTML e leitura concorrente nunca precede autorização: tarefa 2.

## Execução e aprovações

Plano revisado e aprovado autonomamente conforme autorização do usuário. Tarefas 1 e 2 têm arquivos disjuntos e podem ser implementadas em paralelo por agentes distintos, com commits coordenados pelo controlador. A tarefa 3 (baseline) começa antes das alterações; QA depois da integração. O controlador faz a revisão independente por tarefa e uma revisão ampla final. Sem perguntas adicionais.

### Task 1: Cache público da loja com invalidação

**Files:**
- Create: src/lib/data/store-cache.ts (constantes da política)
- Modify: src/lib/data/stores.ts
- Modify: src/app/admin/(painel)/lojas/actions.ts
- Create: tests/content/store-cache.test.ts
- Create: tests/admin/store-cache-action.test.ts

**Interfaces:**
- Consumes: createAdminClient(), Store, StoreInput, saveStore(input): Promise<string>.
- Produces: getStoreBySlug(slug: string): Promise<Store|null> com mesma interface; PUBLIC_STORES_TAG='public-stores', PUBLIC_STORES_REVALIDATE=300.

- [ ] **Step 1: Escrever regressões antes do código.** Usar cliente Supabase real com fetch sintético como tests/content/product-queries.test.ts, e double de next/cache com Map + invalidação para testar política, não alegar integração real. Testar dois slugs, repetição, null, erro e atualização. Server Action stub requireAdmin/saveStore/redirect: evento save:resolved vem antes de invalidate, save rejeitado nunca invalida.

```ts
expect(cacheOptions).toEqual({ tags: ['public-stores'], revalidate: 300 })
expect(await getStoreBySlug('loja-a')).toEqual(storeA)
expect(await getStoreBySlug('loja-a')).toEqual(storeA)
expect(storeRequests).toHaveLength(1)
expect(events).toEqual(['save:resolved', 'invalidate:public-stores', 'revalidate:/admin'])
```

- [ ] **Step 2: Rodar** `npx vitest run tests/content/store-cache.test.ts tests/admin/store-cache-action.test.ts` e registrar falhas esperadas por cache/invalidação ausentes.
- [ ] **Step 3: Implementar a política usando guia local caching-without-cache-components e updateTag.** Extrair o corpo atual da consulta para a função envolvida, sem mudar o mapper ou getStoreById/listStores.

```ts
export const PUBLIC_STORES_TAG = 'public-stores'
export const PUBLIC_STORES_REVALIDATE = 300
// em stores.ts: query e erro atuais permanecem dentro da função
export const getStoreBySlug = unstable_cache(async (slug: string): Promise<Store | null> => {
  const { data, error } = await createAdminClient().from('stores').select(STORE_COLUMNS).eq('slug', slug).maybeSingle()
  if (error) throw error
  return data ? toStore(data as DbStore) : null
}, ['public-store-by-slug-v1'], { tags: [PUBLIC_STORES_TAG], revalidate: PUBLIC_STORES_REVALIDATE })
// em salvarLoja, fora do catch após gravação bem-sucedida:
updateTag(PUBLIC_STORES_TAG)
revalidatePath('/admin', 'layout')
```

- [ ] **Step 4: Rodar testes focados e suíte completa uma vez**, ajustar mocks existentes somente quando necessário. Não esconder avisos preexistentes. Relatar RED/GREEN e limitações do double (QA testará cache real).
- [ ] **Step 5: Auto-revisar diff, escrever report no workspace SDD e informar arquivos prontos ao controlador.** Controlador fará commit isolado e revisão para evitar concorrência no índice.

### Task 2: Menos viagens de conteúdo e resposta de navegação

**Files:**
- Modify: src/lib/data/products.ts
- Modify: src/app/[loja]/item/[id]/page.tsx
- Modify: src/components/membros/skeletons.tsx
- Create: src/app/[loja]/produto/[slug]/loading.tsx
- Create: src/app/[loja]/item/[id]/loading.tsx
- Modify: tests/content/product-queries.test.ts
- Modify: tests/membros/content-routes.test.ts

**Interfaces:**
- Consumes: createAdminClient(), toModule(), toItem(), ModuleWithItems; recordItemAccess(entry): Promise<void>; listPublishedItemsInModule(id): Promise<Item[]>.
- Produces: listModulesWithItems(productId: string, opts: {publishedOnly: boolean}): Promise<ModuleWithItems[]> inalterada; LessonSkeleton(): JSX.Element.

- [ ] **Step 1: Adicionar regressões de consulta e concorrência.** Transporte real Supabase responde relação modules.items. Assert URL de ordem pai e items.order, filtros is_published e items.is_published só no modo publicado, uma requisição, admin com rascunhos, módulo vazio e erro. Promessas controladas demonstram que irmãos iniciam enquanto registro está pendente e a página não resolve; resolver ambos e conferir render. Falha de gravação rejeita; autorização negada nunca inicia essas operações.

```ts
const pendingRecord = deferred<void>()
vi.mocked(recordItemAccess).mockReturnValue(pendingRecord.promise)
const pagePromise = ItemPage({ params: Promise.resolve({ loja: 'loja-a', id: item.id }) } as never)
// usar sinais/deferred existentes para esperar o início, sem limites de milissegundos
await siblingsStarted.promise
expect(recordItemAccess).toHaveBeenCalledOnce()
expect(pageResolved).toBe(false)
pendingRecord.resolve()
await pagePromise
```

- [ ] **Step 2: Rodar** `npx vitest run tests/content/product-queries.test.ts tests/membros/content-routes.test.ts` e registrar RED esperado.
- [ ] **Step 3: Implementar junção e concorrência.** Confirmar API referencedTable nos tipos locais Supabase/PostgREST e guia de dados Next.

```ts
let query = db.from('modules')
  .select(`${MODULE_COLUMNS}, items(${ITEM_COLUMNS})`)
  .eq('product_id', productId)
  .order('sort_order').order('created_at')
  .order('sort_order', { referencedTable: 'items' })
  .order('created_at', { referencedTable: 'items' })
if (opts.publishedOnly) query = query.eq('is_published', true).eq('items.is_published', true)
const { data, error } = await query
if (error) throw error
// mapear cada DbModule & {items: DbItem[]} para ModuleWithItems,
// mantendo filtros defensivos e módulos sem filhos.

const [siblingItems] = await Promise.all([
  listPublishedItemsInModule(ctx.module.id),
  ctx.item.kind === 'video' ? recordItemAccess({ customerId: customer.id, storeId: store.id,
    productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind }) : Promise.resolve(),
])
const siblings = siblingItems.filter(/* validação atual de URL */)
```

- [ ] **Step 4: Adicionar LessonSkeleton conforme padrão de skeletons existente.** Cabeçalho, retângulo aspect-video e lateral; role=status com texto `Carregando material…`, formas decorativas aria-hidden. Loading de produto/item retorna o mesmo componente. Ler docs de loading e linking-and-navigating; manter prefetch=false em links de itens.

```tsx
import { LessonSkeleton } from '@/components/membros/skeletons'
export default function Loading() { return <LessonSkeleton /> }
```

- [ ] **Step 5: Rodar testes focados e suíte completa uma vez**, auto-revisar e escrever report SDD com RED/GREEN e lista de arquivos. Controlador faz commit e revisão isolados.

### Task 3: Baseline, QA no navegador e entrega

**Files:**
- Create: docs/status-carregamento-2026-09-23.md
- Create (fora do git): scripts/evidências em diretório de visualizações desta sessão.

**Interfaces:**
- Consumes: build baseline 2f89ff1 e build final, fixture HTTP sintético baseado no browser-fixture.mjs da rodada anterior.
- Produces: relatório com tempos, contagens, capturas, limitações e revisão de segurança funcional.

- [ ] **Step 1: Antes de alterar código, iniciar fixture local e build baseline.** Fixture usa exclusivamente chaves/contas fictícias; latência 100 ms por Auth/REST. Suportar relação modules.items e filtros/ordem embed no mesmo fixture para ambos os builds; habilitar edição de stores para QA admin, com audit do contador.

```powershell
npm test
npm run build
node '<visualizations>/browser-fixture.mjs' --production
& '<agent-browser.cmd>' --session perf-members-2 open http://127.0.0.1:3100/arquitetura/entrar
```

- [ ] **Step 2: Capturar baseline** login/home/produto/item em 375x812 e 1440x1000. Uma amostra inicial separada e mediana de três aquecidas. Registrar tempo até corpo completo, requisições Auth/REST, vitals e navegação por clique, sem chamar fetch de medição de clique.
- [ ] **Step 3: Após tarefas 1 e 2 revisadas, executar** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; repetir o mesmo protocolo no build final. Verificar backend sem novas leituras de stores após aquecimento, e novas leituras depois de salvar/renomear/criar via admin.
- [ ] **Step 4: QA funcional agent-browser:** login; vitrine->produto->vídeo->próximo/voltar; abrir recursos; modal fechar/reabrir; capturas responsivas; erro JS/overflow; aluno bloqueado, pedido reembolsado, conteúdo oculto/outra loja; cold/warm de cache; store edit/create/rename. Não executar login nem alteração em dados reais.
- [ ] **Step 5: Relatório e revisão final.** Documentar números e método, limites da medição sintética, estado de produção/região e avisos preexistentes. Revisão ampla por subagente distinto, corrigir achados e repetir apenas checks afetados. Integrar localmente com fast-forward somente se seguro e preservar todos os arquivos preexistentes. Não declarar publicado sem deploy confirmado.

## Self-review

Todos os requisitos do design estão associados às tarefas. Tarefas 1/2 não compartilham arquivos; tarefa 3 depende de ambas e valida comportamento real que doubles não comprovam. O layout final não muda. Não há migração, cache de acesso ou alteração remota. O fixture adaptado deve ser idêntico na comparação antes/depois. Plano aprovado em 23/09/2026 pela autorização de aprovação autônoma.
