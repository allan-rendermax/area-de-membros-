# Complementos contextuais com visual Netflix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizar Paisagismo e os três order bumps de Patologias em uma biblioteca Netflix, com ofertas contextuais, acesso avulso preservado e capas 2:3 nas fileiras / 1:1 nas ofertas.

**Architecture:** Relações editoriais muitos-para-muitos, visibilidade por produto e ativação por loja, sem modificar o motor de autorização. Projeções puras e carregamento em lote alimentam home, produto e item; componentes existentes de carrossel, capa e modal preservam a identidade aprovada. Cadastro atômico atende admin e importador; produção de arte e prontidão dos materiais antecedem a ativação comercial.

**Tech Stack:** Next.js 16.3.5, React 19.2.8, TypeScript, Supabase/PostgreSQL, Vitest 5, PGlite, scripts Node existentes e geração de imagens pela skill capas-area-membros. Confirmar versões na base de execução.

**Spec:** `docs/superpowers/specs/2026-10-24-complementos-contextuais-netflix-design.md` — aprovada pelo usuário em 24/10/2026, incluindo os formatos de capa.

Estado: plano preparado para revisão e escolha de execução. Nenhuma tarefa de implementação, geração das novas capas ou publicação foi realizada por este plano.

## Global Constraints

- “As ofertas dos complementos aparecem somente dentro do respectivo produto principal.”
- “Compra avulsa é permitida e não depende de possuir o principal para acessar o material pago.”
- “A associação é editorial, não uma nova forma de conceder acesso.”
- “Não migrar automaticamente os planos atuais para identificação por checkout.”
- “Não enviar campanhas ou reprocessar eventos históricos como efeito de organizar a vitrine.”
- “Não mudar o hero.” Preservar Barlow Condensed, identidade escura, laranja/amarelo e carrosséis horizontais do segundo piloto.
- Capas: `cover_url` 2:3; `purchase_image_url` 1:1. “Não misturar proporções na mesma fileira, esticar imagens ou cortar um mockup quadrado para preencher 2:3.”
- Arte vertical: “1000 × 1500 ou 1024 × 1536, WebP, abaixo de 2 MiB”; meta aproximada de 500 KB quando legível.
- “Não derivar essa regra globalmente de `role` e não ocultar todos os upsells.”
- Preservar o vínculo singular Atlas → Protocolo Anti-Retrabalho; seis bumps contextuais não substituem esse upsell.
- Defaults: `catalog_visibility = 'catalog'`, `member_library_mode = 'legacy'`. Ativação inicial apenas na loja alvo; sem nomes comerciais em regras globais.
- “Alvos devem existir; usar cadastro em duas etapas quando ambos forem novos”. Omissão preserva; `complementos: nenhum` limpa somente a nova lista.
- “Não apontar para a raiz compartilhada que contém outros produtos.” PDFs precisam de validação/otimização e relatório com hashes antes da publicação.
- Ler AGENTS e documentação local do Next na base efetiva antes de editar runtime. Preservar alterações alheias do workspace.

## Review Focus

1. Edições simultâneas de relações opostas ou da mesma ficha: apenas uma gravação válida, sem ciclo ou sobrescrita silenciosa. Testes SQL e duas conexões na tarefa 2.
2. Complemento comprado com principal reembolsado, rascunho, removido ou de outra loja: compra continua avulsa quando publicável, sem vazamento entre lojas. Testes de projeção na tarefa 3.
3. Histórico do Completo após mudança para Básico em `versions`: retomar somente item ainda autorizado, com destino seguro se o último sumiu. Testes de continuidade na tarefa 4.
4. Mesma dupla em relação nova e singular, mais acesso por link antigo: uma chamada, Protocolo preservado, oferta contextual somente com principal elegível. Testes de rotas na tarefa 7.
5. Relações indisponíveis ou gravação interrompida depois de upload: compras acessíveis, ofertas contextuais omitidas, campos/relações sem gravação parcial e imagens anteriores preservadas. Testes de dados/admin nas tarefas 4 e 5.

## Base verificada e sequência

Em 24/10, este workspace está em `0454fcd` (`codex/ofertas-com-planos`) e contém muitas alterações preexistentes. O relatório de publicação de Paisagismo aponta `eb0550ad408d36e72b19940d7d1e80a58df17923`, disponível localmente no worktree `C:/Users/arqal/.codex/worktrees/urbanismo-checkout/Area de membros`. Isso é uma referência histórica confirmada no Git, não uma afirmação de que ainda seja o deploy atual.

Esse commit contém identificação de planos por checkout, `preview-context.ts`, `product-form-editor.tsx`, verificações de prontidão e `listRecentProductVisits`. Os caminhos abaixo consideram essa base mais recente; a tarefa 1 confirma o deploy efetivo e resolve eventuais diferenças. Não copiar sobre ela os arquivos mais antigos deste workspace. A melhoria das setas do carrossel está no histórico local (`ebafa5e`) e deve ser preservada ao reconciliar as bases.

Fluxo: 1 → 2 → 3/4 → 5/6 → 7 → 9. A tarefa 8 prepara materiais/artes após o inventário da tarefa 1; a tarefa 10 depende de 8 e 9. As tarefas são partes da mesma entrega, não projetos de redesign separados. Infraestrutura e UI podem ficar prontas com fixtures enquanto um material real aguarda entrega.

## Mapa de arquivos e interfaces

| Responsabilidade | Arquivos |
|---|---|
| Dados novos / gravação | `supabase/migrations/20261024020000_contextual_complements.sql`, `20261024021000_save_contextual_product.sql` (novos; confirmar numeração livre) |
| Tipos / mapeamento | `src/lib/domain/types.ts`, `src/lib/data/products.ts`, `src/lib/data/stores.ts` |
| Regras puras | `src/lib/access/contextual-complements.ts` (novo), `src/lib/access/access.ts` (tipo da capa; preservar cálculo de direitos) |
| Consultas em lote | `src/lib/data/contextual-complements.ts` (novo), `src/lib/data/item-access.ts` (somente se necessário ao contrato da base) |
| Biblioteca / continuidade | `src/lib/membros/contextual-library.ts` (novo), `src/app/[loja]/page.tsx` |
| Admin | `src/lib/admin/forms.ts`, `src/lib/data/products-admin.ts`, `src/app/admin/(painel)/produtos/{actions.ts,product-form.tsx,product-form-editor.tsx,[id]/page.tsx}`, `contextual-complement-fields.tsx` (novo no mesmo diretório) |
| Modo da loja | `src/app/admin/(painel)/lojas/{store-form.tsx,actions.ts}`, `src/lib/data/store-cache.ts` (reutilizar invalidação) |
| Importador | `scripts/lib/{cadastro-plano.mjs,cadastro-executor.mjs}`, `scripts/cadastrar-produto.mjs`, `docs/como-cadastrar-produto.md` |
| Componentes novos | `src/components/membros/{owned-product-group.tsx,contextual-complement-shelves.tsx,contextual-complements.module.css}` |
| Composição existente | `src/components/membros/{item-content.tsx,locked-poster.tsx,product-complement.tsx}`, `src/app/[loja]/produto/[slug]/page.tsx`, `src/app/[loja]/item/[id]/page.tsx` |
| QA e operação | `tests/fixtures/contextual-products.ts`, novos testes detalhados abaixo, `scripts/qa-contextual-complements-fixture.mjs`, `docs/qa/complementos-contextuais/`, `artifacts/complementos-contextuais-20261024/` |

Contratos novos (nomes consistentes em todas as tarefas):

```ts
// domain/types.ts; Product e Store recebem as propriedades opcionais abaixo
export type CatalogVisibility = 'catalog' | 'contextual'
export type MemberLibraryMode = 'legacy' | 'grouped'
export type ContextualRelation = {
  storeId: string; parentProductId: string; complementProductId: string; sortOrder: number
}
// Product: catalogVisibility?: CatalogVisibility; editorialRevision?: number
// Store: memberLibraryMode?: MemberLibraryMode

// access/contextual-complements.ts
export type ContextualInput = {
  storeId: string; products: readonly Product[]; relations: readonly ContextualRelation[]
  granted: ReadonlySet<string>; includeDrafts?: boolean
}
export type OwnedGroup = { product: Product; complements: Product[] }
export type LibraryProjection = {
  owned: OwnedGroup[]; discovery: Product[]; groupByProductId: Map<string, string>
}
export type ProductComplements = { owned: Product[]; optional: Product[]; backParent: Product | null }
export function projectContextualLibrary(input: ContextualInput): LibraryProjection
export function projectProductComplements(input: ContextualInput, parentId: string): ProductComplements
export function eligibleContextualParent(input: ContextualInput, complementId: string): Product | null

// data/contextual-complements.ts
export type RelationsResult = { relations: ContextualRelation[]; available: boolean }
export function listContextualRelations(storeId: string): Promise<RelationsResult>

// membros/contextual-library.ts
export type ResumeCard = { product: Product; materialTitle: string; href: string }
export function projectContextualResume(input: ContextualInput, projection: LibraryProjection,
  visits: readonly RecentProductVisitWithAccess[], levels: ReadonlyMap<string, AccessLevel>,
  storeSlug: string): ResumeCard[]
export type ContextualRequest =
  | { kind: 'owned' | 'offer'; href: string }
  | { kind: 'unavailable' } | { kind: 'legacy' }
export function resolveContextualRequest(input: ContextualInput, slug: string, storeSlug: string): ContextualRequest
```

`Product`, `AccessLevel` vêm de `domain/types`; `RecentProductVisitWithAccess` já existe em `data/item-access.ts` na base publicada de referência. Os contratos acima descrevem exports; não criar arquivos de funções vazias. A execução deve implementar cada comportamento junto dos testes da respectiva tarefa.

### Task 1: Fixar a base de execução e o inventário verificável

**Files:** ler AGENTS, diretriz, spec, relatório de Paisagismo, `docs/status-regularizacao-orderbumps-2026-09-26.md`; criar `artifacts/complementos-contextuais-20261024/base.md` e `inventario.json`. Sem edição de runtime.

**Interfaces:** consome release e catálogo reais; produz SHA/base escolhidos, inventário de IDs/estados e lista explícita de diferenças necessárias.

- [ ] Conferir checkout e alterações sem mudar o diretório compartilhado:

```powershell
git status --short
git worktree list
git show --stat eb0550ad408d36e72b19940d7d1e80a58df17923
git diff --stat HEAD eb0550ad408d36e72b19940d7d1e80a58df17923 -- src scripts supabase
```

- [ ] Consultar metadados de deployment pelo mecanismo configurado no projeto e registrar SHA, URL e data. Se não estiver disponível, preparar sobre a referência histórica e manter a publicação pendente até reconciliar; não declarar correspondência com produção sem evidência.
- [ ] Inspecionar anexos/worktrees com `list_artifacts`; reutilizar um adequado e livre. Se necessário, usar `create_worktree` com o ref verificado e a skill using-git-worktrees. Não resetar, limpar ou assumir o worktree de outro trabalho. Transferir somente spec, plano e referência visual necessários; aplicar a correção das setas somente se ausente.
- [ ] Ler os guias locais do Next sobre Server/Client Components, Server Actions e revalidação nessa base. Manter sessão/autorização no servidor e estado interativo pequeno no cliente.
- [ ] Inventariar os dois principais, seis complementos e Protocolo por IDs, loja, publicação, imagens, URLs, relações e ofertas. Conferir materiais e identificadores comerciais por leitura; não copiar dados pessoais/segredos para o relatório. Registrar campos ausentes como `null` e pendência explicada, nunca inventar códigos Payt.
- [ ] Rodar baseline na base isolada e guardar resultados:

```powershell
npm test -- tests/access tests/orders tests/payt tests/membros tests/cadastro tests/admin
npm run lint
npm run build
```

Esperado: checks passam; falhas preexistentes ficam identificadas com comando e escopo, sem atribuí-las à implementação. Ao final, commit apenas de documentação versionável da tarefa; inventários sensíveis ficam fora do Git.

### Task 2: Modelo editorial, invariantes e gravação atômica

**Files:** criar as duas migrations do mapa; criar `tests/admin/contextual-complements-sql.test.ts`, `tests/admin/contextual-product-save.test.ts`, `tests/helpers/contextual-db.ts`; modificar tipos/mapeadores de Product e Store.

**Interfaces:** banco adiciona os três conceitos da spec e `products.editorial_revision bigint not null default 0`. RPC `save_contextual_product(p_store_id uuid, p_product_id uuid, p_expected_revision bigint, p_patch jsonb, p_complement_ids uuid[]) returns uuid`; SQL NULL na lista preserva, array vazio limpa. Novo produto usa ID e revisão NULL; edição exige revisão atual. `p_patch` contém somente campos editoriais permitidos, nunca direitos/pedidos.

- [ ] Criar testes PGlite executando as migrations reais. `contextual-db.ts` monta stores/products com as colunas usadas pela RPC, roles `anon`, `authenticated`, `service_role`, constraint `(store_id,id)` e semeia duas lojas e quatro produtos; fecha bancos em `afterEach`. Não reutilizar fixture de checkout truncada como se fosse o schema completo.
- [ ] Exercitar asserções SQL de comportamento: defaults; par duplicado; relação entre lojas; self; A→B→C; A→B+B→A; compartilhamento A→C e B→C; remoção de principal; produto com compra continua protegido pela exclusão existente; rollback de título e relações numa mesma gravação inválida; revisão antiga recusada; RPC indisponível para anon/authenticated.
- [ ] Rodar `npm test -- tests/admin/contextual-complements-sql.test.ts tests/admin/contextual-product-save.test.ts`; esperar falha pela migration/RPC ausente. Implementar o schema base:

```sql
alter table public.products
  add column catalog_visibility text not null default 'catalog'
    check (catalog_visibility in ('catalog','contextual')),
  add column editorial_revision bigint not null default 0;
alter table public.stores
  add column member_library_mode text not null default 'legacy'
    check (member_library_mode in ('legacy','grouped'));
create table public.product_complements (
  store_id uuid not null references public.stores(id) on delete cascade,
  parent_product_id uuid not null,
  complement_product_id uuid not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (store_id, parent_product_id, complement_product_id),
  foreign key (store_id, parent_product_id)
    references public.products(store_id,id) on delete cascade,
  foreign key (store_id, complement_product_id)
    references public.products(store_id,id) on delete cascade,
  check (parent_product_id <> complement_product_id)
);
create index product_complements_target
  on public.product_complements(store_id, complement_product_id);
alter table public.product_complements enable row level security;
revoke all on public.product_complements from anon, authenticated;
grant select, insert, update, delete on public.product_complements to service_role;
```

- [ ] Implementar trigger de invariantes: serializar edição do grafo por loja com lock da linha `stores`; recusar novo principal presente como alvo e novo alvo presente como principal. Isso permite muitos principais compartilharem um complemento e impede cadeias. Na RPC, adquirir lock antes das leituras/validação e revisar dentro da transação; não depender só do preflight JS. Exigir essas invariantes também nas escritas diretas por service role.
- [ ] Implementar RPC com `security invoker`, `search_path` explícito e `EXECUTE` revogado de PUBLIC/anon/authenticated, concedido somente a service_role. Sequência: lock da loja → carregar produto daquela loja `FOR UPDATE` → comparar revisão → validar chaves/tipos de patch e relações → gravar produto → substituir lista quando presente → retornar ID. Qualquer erro desfaz tudo.
- [ ] Patch permitido: campos atuais de `saveProduct`, mais `catalog_visibility`; negar `store_id`, `id`, `editorial_revision`, campos desconhecidos e timestamps enviados pelo cliente. `complementary_product_id` singular mantém semântica anterior. Adicionar trigger de incremento de `editorial_revision` em todo UPDATE de products; alterações diretas e no grafo invalidam formulários antigos. Evitar duplo incremento quando a mesma RPC grava lista e produto; revisão é opaca, comparar igualdade, nunca exigir +1 na UI.
- [ ] Testar criação, update com omissão, lista vazia e atualização de campos existentes. Exemplos de contrato SQL a executar na fixture (UUIDs constantes declarados nela):

```sql
select save_contextual_product($1, $2, $3, '{"title":"Atlas revisado"}', $4::uuid[]);
select title, editorial_revision from products where id = $1;
select complement_product_id from product_complements
 where store_id = $1 and parent_product_id = $2 order by sort_order;
```

- [ ] Verificar concorrência em PostgreSQL de teste com duas conexões, além de PGlite: iniciar A→B e B→A simultaneamente; no máximo uma confirma. Duas edições da mesma revisão: uma confirma, a outra pede recarregar. Registrar resultado; PGlite sozinho não comprova esse cenário.
- [ ] Adicionar colunas às consultas/mapeadores com defaults compatíveis para fixtures antigas; não remover `complementary_product_id`. Rodar testes novos + mapeadores/exclusões existentes. Commit das migrations, tipos e testes, sem seed comercial.

### Task 3: Projeção pura da biblioteca e complementos

**Files:** criar `src/lib/access/contextual-complements.ts`, `tests/fixtures/contextual-products.ts`, `tests/access/contextual-complements.test.ts`; modificar `src/lib/access/access.ts` apenas se necessário para transportar `catalogVisibility` ao `ShelfProduct`.

**Interfaces:** implementa `ContextualInput`, `LibraryProjection`, `ProductComplements` e as três funções do mapa. Ordenar agrupadores pelo `sortOrder` do produto principal e desempatar por `id`; ordenar complementos pela ordem da relação e ID. Nenhuma função consulta banco ou muda `granted`.

- [ ] Criar fixture reutilizável e teste inicial:

```ts
// tests/fixtures/contextual-products.ts
import type { Product, ContextualRelation } from '@/lib/domain/types'
export function product(id: string, patch: Partial<Product> = {}): Product {
  return { id, storeId: 's1', slug: id, title: id, track: 'Atlas Visuais',
    description: '', coverUrl: null, bannerUrl: null, checkoutUrl: null,
    role: 'front', isFeatured: false, sortOrder: 0, isPublished: true,
    catalogVisibility: 'catalog', ...patch }
}
export function relation(parentProductId: string, complementProductId: string, sortOrder = 0): ContextualRelation {
  return { storeId: 's1', parentProductId, complementProductId, sortOrder }
}
```

```ts
import { expect, it } from 'vitest'
import { projectContextualLibrary } from '@/lib/access/contextual-complements'
import { product, relation } from '../fixtures/contextual-products'
it('devolve a compra avulsa quando o principal deixa de estar adquirido', () => {
  const input = { storeId: 's1', products: [product('atlas'), product('guia', { catalogVisibility: 'contextual' })],
    relations: [relation('atlas', 'guia')], granted: new Set(['atlas', 'guia']) }
  const grouped = projectContextualLibrary(input)
  expect(grouped.owned.map(g => [g.product.id, g.complements.map(p => p.id)]))
    .toEqual([['atlas', ['guia']]])
  const solo = projectContextualLibrary({ ...input, granted: new Set(['guia']) })
  expect(solo.owned.map(g => [g.product.id, g.complements.length])).toEqual([['guia', 0]])
  expect(solo.discovery.map(p => p.id)).toEqual(['atlas'])
})
```

- [ ] Rodar `npm test -- tests/access/contextual-complements.test.ts`, confirmar falha e implementar: filtrar produtos pela loja/publicação; validar pontas das relações; calcular pais elegíveis; construir um único grupo por compra; separar descoberta excluindo contextuais e adquiridos. Sem pai, o complemento comprado é raiz de grupo avulso.
- [ ] Implementar oferta interna somente se principal estiver elegível/adquirido; lista `owned` por direito próprio e `optional` pelo complemento não adquirido. `backParent` usa a mesma seleção determinística. Preview editorial pode incluir drafts explicitamente; simulação de compra usa direitos simulados separados, nunca persiste direitos reais.
- [ ] Adicionar casos em tabela e repetir teste: 0/1/3/4 complementos (sem limite três), sem compras, todos adquiridos, pai oculto/removido, alvo oculto, IDs de outra loja, relação repetida defensivamente, compartilhado com ordem embaralhada, ausência de relação, nenhum efeito de `role`. Congelar entradas com `Object.freeze` e verificar que não foram mutadas.
- [ ] Preservar exceção legada de descoberta Atlas→Protocolo somente no adaptador da home, não dentro desta função genérica. Commit após testes da projeção e `tests/access/shelf.test.ts` / `tracks.test.ts` passarem.

### Task 4: Dados em lote, continuidade e resolução dos links antigos

**Files:** criar `src/lib/data/contextual-complements.ts`, `src/lib/membros/contextual-library.ts`, `tests/content/contextual-complements.test.ts`, `tests/membros/contextual-resume.test.ts`, `tests/membros/contextual-request.test.ts`. Reutilizar `data/access.ts`, `data/item-access.ts`, `membros/resume-material.ts`, `access/product-content.ts`.

**Interfaces:** `listContextualRelations` retorna disponibilidade separada dos dados; funções de continuidade/links seguem o mapa. Relações são uma consulta por loja, com paginação explícita além do limite PostgREST; não uma consulta por capa. Direitos são carregados uma vez por requisição e passados à composição.

- [ ] Testar consulta filtrada por loja, paginação, falha de relações e quantidade de chamadas independente do número de capas. Rodar `npm test -- tests/content/contextual-complements.test.ts` antes e depois da implementação. Falha de relações retorna `{ relations: [], available: false }`; falha de autorização propaga erro recuperável, nunca `{ granted: all }`.
- [ ] Implementar continuidade com `listRecentProductVisits`: filtrar produto publicado e adquirido, aplicar `canAccessProductModule` ao nível/modo de cada item, selecionar visita autorizada mais recente por grupo. Se nenhum item estiver utilizável, permitir fallback à página de um produto ainda adquirido; nunca criar histórico fictício. `materialTitle` é o título do produto retomado, distinto do título da capa agrupadora.
- [ ] Teste concreto usando as fixtures da tarefa 3:

```ts
it('retoma o item do complemento usando a capa do grupo', () => {
  const input = { storeId: 's1', products: [product('atlas'), product('guia')],
    relations: [relation('atlas', 'guia')], granted: new Set(['atlas', 'guia']) }
  const cards = projectContextualResume(input, projectContextualLibrary(input), [
    { productId: 'guia', itemId: 'item-guia', accessedAt: '2026-10-24T12:00:00Z', availableItem: { requiredLevel: 'basic' } },
  ], new Map([['atlas', 'complete'], ['guia', 'complete']]), 'arquitetura')
  expect(cards).toEqual([{ product: input.products[0], materialTitle: 'guia', href: '/arquitetura/item/item-guia' }])
})
```

- [ ] Adicionar testes de última visita removida, downgrade, `versions` Completo não herdando Básico, links externos inválidos, grupo com duas visitas, avulso, outra loja e cliente bloqueado (direitos vazios). Não afrouxar a autorização do endpoint de download.
- [ ] Resolver `?comprar=slug`: adquirido → URL própria; contextual sem compra + pai elegível → `/{loja}/produto/{pai.slug}?complemento={alvo.slug}#complementos`; contextual sem pai ou dados de relações indisponíveis → estado indisponível com suporte; produto comum → legado. Codificar segmentos/parâmetros com as funções de URL existentes/`encodeURIComponent`.
- [ ] Testar redirecionamento sem loop para home→produto→home, alvo inexistente, sem checkout e pedido pendente. `?complemento=` apenas abre detalhes; não entra no cálculo de acesso. Rodar os três testes novos e continuidade existente. Commit dados e regras de navegação.

### Task 5: Admin configurável com gravação segura

**Files:** arquivos admin do mapa, tipos/mapeadores de Store e Product, `src/lib/admin/forms.ts`, `src/lib/data/products-admin.ts`; novos `tests/admin/contextual-complement-form.test.ts`, `tests/admin/contextual-complement-actions.test.ts`.

**Interfaces:** estender `ProductInput` com `catalogVisibility?: CatalogVisibility`, `contextualComplementIds?: string[]`, `expectedEditorialRevision?: number`. `undefined` preserva; `[]` limpa. `saveProduct` usa a RPC da tarefa 2; `parseProductForm` lê lista JSON somente quando o campo existe. Editor envia revisão carregada; servidor retorna nova revisão ao salvar sem recarregar a página.

- [ ] Testar parser com `FormData`: ausência preserva, `[]` limpa, duplicatas/UUID inválido/visibilidade desconhecida falham. A revisão é inteiro seguro não negativo, obrigatória para edição no fluxo novo. Adicionar teste de action sem sessão admin ou store_id adulterado.
- [ ] Implementar serialização no componente novo e adaptar formulário real da base publicada:

```tsx
<input type="hidden" name="contextual_complement_ids" value={JSON.stringify(selectedIds)} />
<input type="hidden" name="editorial_revision" value={revision} />
<select name="catalog_visibility" defaultValue={product.catalogVisibility ?? 'catalog'}>
  <option value="catalog">Catálogo geral</option>
  <option value="contextual">Somente dentro dos produtos associados</option>
</select>
```

`selectedIds` é o estado ordenado de IDs do seletor; `revision` vem do produto carregado/resposta salva. Botões “Subir”, “Descer” e “Remover” acessíveis por teclado, checkboxes com títulos completos; sem limite fixo. O aviso de contextual sem principal publicado não bloqueia acesso avulso nem promove automaticamente ao catálogo.
- [ ] Adicionar seletor da loja com `legacy`/`grouped`, default legado. Autenticar, validar contexto e invalidar o cache público de Store após gravação com o mecanismo atual; nunca armazenar direitos de cliente no cache compartilhado.
- [ ] Fazer preflight de relações antes de uploads e persistir campos+lista somente na RPC. Preservar tratamento existente de uploads e formulário com erros. Em conflito, manter rascunho visível e pedir recarregar; não reenviar automaticamente contra revisão nova. Uma falha após upload não troca URL anterior no produto; objetos novos sem referência não justificam apagar imagens antigas.
- [ ] Preservar `assertProductPublicationReady`, slots separados de capa/oferta, campo singular e uploads imediatos existentes. Manter saves por ambas actions antigas/novas consistentes. Testar omissão de campos por formulários antigos; a transição para RPC não deve rebaixar configuração comercial.
- [ ] Testar rollback de produto/lista, revisão stale, erro de upload, enum da loja, aviso de órfão contextual e segunda edição após save bem-sucedido. Rodar testes novos + `tests/admin/product-complement.test.ts`, `tests/admin/student-checkout-persistence.test.ts`, formulários existentes. Commit do admin.

### Task 6: Importador por pasta sem perda de configurações existentes

**Files:** `scripts/lib/cadastro-plano.mjs`, `scripts/lib/cadastro-executor.mjs`, `scripts/cadastrar-produto.mjs`, `tests/cadastro/contextual-complements.test.ts`, `docs/como-cadastrar-produto.md`.

**Interfaces:** `lerFicha` retorna `complementos?: string[]` (nenhum → []) e `visibilidadeCatalogo?: 'catalog'|'contextual'`; executor resolve IDs da mesma loja no preflight, lê revisão e chama a mesma RPC. Alvos têm que existir antes do lote; ordem do texto vira sort_order.

- [ ] Escrever e rodar teste de parse:

```ts
import { expect, it } from 'vitest'
import { lerFicha } from '../../scripts/lib/cadastro-plano.mjs'
const base = 'nome: Atlas\nid: CODE\ntag: front\nloja: arquitetura\nslug: atlas'
it('distingue preservar, limpar e relacionar', () => {
  expect(lerFicha(base)).not.toHaveProperty('complementos')
  expect(lerFicha(`${base}\ncomplementos: nenhum`).complementos).toEqual([])
  expect(lerFicha(`${base}\ncomplementos: guia, orcamento`).complementos).toEqual(['guia', 'orcamento'])
  expect(lerFicha(`${base}\nvisibilidade_catalogo: contextual`).visibilidadeCatalogo).toBe('contextual')
  expect(() => lerFicha(`${base}\ncomplementos: guia, guia`)).toThrow()
})
```

- [ ] Implementar novas chaves no parser, rejeitando vazio ambíguo, slugs inválidos, autorreferência e valores fora do enum. Preservar chave singular `complemento:` e campos de checkout da base publicada.
- [ ] Resolver todas as referências antes de upload/escrita; erro nomeia slug/loja sem expor segredos. Preflight inclui grafo planejado do lote, inclusive duas novas relações que juntas criariam cadeia. A RPC repete a verificação para concorrência; reimportação idempotente não duplica relações.
- [ ] Adicionar testes de executor: alvo ausente/outra loja/ciclo/duplicata causam zero uploads e zero escritas; falha da RPC não salva parte do produto/lista; omissão preserva visibilidade/lista; `nenhum` não apaga singular; importação antiga mantém planos/checkouts. A atomicidade prometida é produto+relações, não todo upload/conteúdo/ofertas de um lote.
- [ ] Atualizar simulação para mostrar preservar/limpar/substituir e visibilidade; documentação mostra cadastro em duas etapas. O `--simular` existente só comprova parsing local se não consultar banco: não descrevê-lo como validação de existência remota. Preflight remoto continua obrigatório antes da aplicação.
- [ ] Rodar `npm test -- tests/cadastro` e commit somente arquivos desta tarefa.

### Task 7: Aplicar a organização sem perder o visual Netflix

**Files:** componentes e três rotas do mapa; novos `tests/membros/contextual-library.test.ts`, `tests/membros/contextual-product-routes.test.ts`, `tests/membros/contextual-offer.test.ts`; alterar `src/lib/membros/preview-context.ts`/controles apenas para a simulação necessária.

**Interfaces:** `OwnedProductGroup({ group, storeSlug, preview })`, `ContextualComplementShelves({ complements, storeSlug, preview, requestedSlug })`; dados já autorizados chegam por props. Carrosséis e posters existentes continuam sendo a base. Composição compartilhada passa por `renderItemContent` e fallback de produto sem item.

- [ ] Testar DOM renderizado, não busca textual no código: um principal+um adquirido mostra um grupo e link próprio; não adquirido não aparece na expansão; três comprados retiram fileira opcional; imagem da fileira e imagem da oferta usam campos distintos. Usar Vitest/happy-dom/ReactDOM existentes; não adicionar biblioteca só para verificar classes.
- [ ] Implementar expansão com HTML nativo, fora do link da capa:

```tsx
{group.complements.length > 0 && <details>
  <summary>{group.complements.length} {group.complements.length === 1 ? 'complemento adquirido' : 'complementos adquiridos'}</summary>
  <ul>{group.complements.map(item => <li key={item.id}>
    <Link href={withPreview(`/${storeSlug}/produto/${item.slug}`, preview)}>{item.title}</Link>
  </li>)}</ul>
</details>}
```

- [ ] Home `grouped`: manter hero/header; “Continuar” com retomada validada; “Meus materiais” com grupos; descoberta por trilhas já existentes, usando somente catálogo elegível. Não restringir aos dois exemplos do piloto. No hero comercial genérico, excluir contextual antes de escolher featured. Não renderizar seções vazias.
- [ ] Modo `legacy` conserva apresentação antiga. No modo agrupado, processar Protocolo pelo caminho legado, incluindo a exceção editorial da spec. Se o mesmo par existir nos dois modelos, retirar a versão singular somente daquele par e renderizar a contextual uma vez. Nunca duplicar compras na biblioteca para preservar uma oferta legada.
- [ ] Produto e item: conteúdo/upgrade conforme acesso real → “Seus complementos” → “Complemente seu material”. Mesma composição nos dois caminhos; visual não depende do fallback de produto vazio. Capa 2:3 com selo/texto externo, sem CTA sobre o título. Reutilizar `LockedPoster`/`Modal` para oferta 1:1; se reutilização exigir adaptação, acrescentar props compatíveis em vez de duplicar toda a lógica de foco.
- [ ] `?complemento=` só abre detalhe se alvo pertence ao principal publicado/adquirido. Ao fechar, remover apenas esse parâmetro e devolver foco ao gatilho. Reaproveitar `preferredCheckoutUrl`; sem checkout, mensagem sem link vazio. Imagem ausente: título/fallback, nunca recorte 2:3 dentro de quadrado. Retorno do checkout mostra “Conferir meu acesso” e suporte; nova leitura do servidor decide posse.
- [ ] Voltar da página do complemento usa pai elegível ou biblioteca. Complemento avulso não recebe fileira comercial de outros bumps. URLs de produto/item/download e e-mail continuam válidas. Links antigos seguem `resolveContextualRequest`, inclusive com falha de relações.
- [ ] Prévia exige admin antes de interpretar estado simulado. Preservar `editorial/basic/complete/locked`; acrescentar simulação de complementos com estados `nenhum/um/todos/avulso` somente em prévia administrativa, sem escrever compras ou histórico. Não reutilizar o seletor fake do piloto como autenticação.
- [ ] Rodar novos testes e regressões de `locked-poster`, `modal`, `item-content-complement`, `product-complement`, `content-routes`, `admin-preview`, `product-upgrade`. Validar tema, foco, Escape, teclado, toque e motion reduzido no browser antes do commit.

### Task 8: Preparar seis capas e conferir entregas reais

**Files:** `artifacts/complementos-contextuais-20261024/{inventario.json,prontidao.json,capas/manifest.json,capas/originais/,capas/finais/,relatorio-artes.md}`. Fichas importáveis finais em subdiretório `importar/`, separado dos originais e relatórios.

**Interfaces:** inventário associa produto/ID/loja a `portraitPath`, `squarePath`, hashes, dimensões e prontidão de conteúdo/comércio. Arquivo ausente permanece pendência explícita. Não usar mockups como prova de material entregue.

- [ ] Conferir os seis títulos literais e entregáveis. Patologias: Gestão de Obras, Orçamento de Obras, Captação e Atendimento. Paisagismo: Planta Certa, Orçamento de Jardins e Mestres do Paisagismo. Localizar a versão final de Mestres; a nota local “Produção em andamento” não basta para liberar o produto.
- [ ] Ler/aplicar skills `capas-area-membros` e `imagegen` na produção; `otimizar-pdfs` para PDFs antes de upload. Preservar originals e usar relatórios prévios somente com hash coincidente. Conferir planilha/documentos e link da pasta específica; não expor raiz de outros produtos.
- [ ] Gerar seis capas 2:3 com o título literal e identidade da spec. Brief individual: Planta Certa — seleção de espécies/jardim tropical; Orçamento de Jardins — implantação e orçamento; Mestres — composição e linguagem de projeto; Gestão — cronograma e acompanhamento; Orçamento de Obras — quantitativos; Captação — briefing/proposta/atendimento. Azul-marinho #183453, tipografia condensada branca, laranja #ff5a16 e detalhe amarelo #ffd53d. Sem contagens/preços/personagens/autorias inventadas.
- [ ] Reutilizar 1:1 de Patologias após conferir conteúdo e resolução. Gerar 1:1 para Paisagismo apenas quando não houver arte adequada; confirmar antes os entregáveis ilustrados. Não assumir que são necessárias doze imagens novas.
- [ ] Exportar vertical em WebP 1000×1500 ou 1024×1536; quadrada 1024×1024. Medir dimensões/bytes/hashes pelo runtime disponível; verificar integralmente títulos e acentos e miniaturas a 150–200 px. Guardar prancha comparativa com as seis capas e captura nas fileiras/modais de homologação. Regerar arte com texto incorreto; não corrigir distorcendo a imagem.
- [ ] Manifesto registra fonte, versão final, dimensões, bytes, SHA-256 e destino do campo. Só permitir `cover_url` ← vertical e `purchase_image_url` ← quadrada. Antes de substituir, guardar URL/hash anteriores. Hero e outros produtos não entram no lote.
- [ ] Marcar prontidão por produto: material final válido + arquivo/link testado + códigos comerciais confirmados + artes revisadas. Um pendente fica em rascunho e fora das ofertas; se já existir comprador, registrar entrega pendente para regularização explícita. Não ocultar uma compra publicada válida por um problema meramente de capa. Resultado desta tarefa é pacote revisável, ainda sem upload/publicação automática.

### Task 9: Validar aplicação integrada, acesso e fidelidade visual

**Files:** criar `scripts/qa-contextual-complements-fixture.mjs`, `docs/qa/complementos-contextuais/relatorio.md`, capturas e fixtures sintéticas; atualizar testes de acesso/checkout da base quando necessário para incluir os cenários reais anonimizados.

**Interfaces:** fixture somente em banco local/homologação, loja/cliente sintéticos com identificadores exclusivos. Não criar pagamento pago fictício em produção. Relatório relaciona cenário, resultado, captura e comando.

- [ ] Criar/usar fixtures para Básico e Completo com 0/1/3 bumps, somente avulso, nenhum acesso, principal reembolsado+complemento pago, complemento reembolsado+principal pago, compra válida adicional, bloqueado, rascunho, vínculo removido, complemento compartilhado e segunda loja legada.
- [ ] Testar integração de checkout/bump via parser/processador reais em ambiente de teste: aliases históricos de Patologias preservados; Paisagismo usa IDs conferidos no inventário. Separar principal e linha de bump no evento. Reenvio é idempotente; desconhecido não concede plano; reembolso de uma linha não apaga outra compra válida. Desabilitar envio de e-mail externo nesse ambiente.
- [ ] Rodar suíte e verificações uma vez sobre a composição final, repetir só após mudança/falha relevante:

```powershell
npm test
npm run lint
npm run build
git diff --check
```

- [ ] Browser real em 1440px, 390px e 320px: home, expansão, avulso, principal Básico/Completo, item, oferta quadrada, todos adquiridos e sem compra. Comparar com `artifacts/piloto-complementos-20261024/netflix-screenshots/` (segunda versão). Conferir arte original do hero, Barlow, posters 2:3, setas visíveis, rolagem nativa, ausência de overflow da página e textos legíveis.
- [ ] Abrir/fechar oferta por mouse/teclado/toque, testar Escape/restauração de foco e movimento reduzido. Simular imagem quebrada, relações com erro, checkout ausente e título longo. Navegar URL antiga de compra e URL direta de material. Conferir endpoint de arquivo com e sem direito; URL de retorno nunca libera conteúdo.
- [ ] Verificar desempenho por número de consultas: não cresce por produto e não recarrega direitos por complemento. Verificar que dados de outro cliente/loja não entram no HTML/props/cache. Revisar diff inteiro para impedir migração comercial acidental ou inclusão de alterações alheias.
- [ ] Registrar cobertura dos 12 critérios da spec, falhas corrigidas e quaisquer limitações reais. Commit dos testes/documentação e correções específicas; não incorporar artefatos com dados pessoais, cookies, tokens ou links de download assinados.

### Task 10: Preparar aplicação gradual e reversão

**Files:** criar `docs/qa/complementos-contextuais/publicacao.md`; preparar `artifacts/complementos-contextuais-20261024/{antes.json,aplicacao.json,depois.json,rollback.json}` e fichas finais do cadastro. Capturas/configurações comerciais devem ser renovadas na execução, não reutilizadas como snapshot atual.

**Interfaces:** plano operacional revisável identifica base testada, migrations, IDs, alterações exatas e critérios de prontidão. Publicação é etapa posterior à implementação validada e à autorização correspondente; este documento não declara deploy aprovado ou realizado.

- [ ] Capturar imediatamente antes da ativação: versão do app, modo da loja, produtos/visibilidade, imagens, relações novas/legadas e configuração comercial dos oito produtos mais Protocolo. Se campos mudaram desde o inventário, reconciliar; não sobrescrever edição mais recente.
- [ ] Aplicar migrations aditivas compatíveis primeiro, verificar defaults e permissões, depois disponibilizar versão testada com loja em `legacy`. Nenhuma migration de schema contém seed com título/slug comercial.
- [ ] Cadastrar/validar novos produtos inicialmente em rascunho, upload de artes e conteúdo conferidos e mapeamentos comerciais já verificados. Associação produto+lista usa RPC; links avulsos reutilizam o mesmo produto. Não inventar ou substituir códigos existentes de Patologias. Compra/entrega anterior incompleta entra em relatório próprio, sem replay ou mensagem automática.
- [ ] Configurar relações Paisagismo→seus três e Patologias→seus três, preservando Protocolo. Preparar mudança de visibilidade dos seis e modo `grouped` para execução conjunta em transação de configuração, ou dentro de janela sem vitrine intermediária; falha desfaz essa configuração. Complemento sem prontidão continua rascunho, não é oferta. Não declarar os seis liberados enquanto houver pendente.
- [ ] Conferir snapshot posterior: apenas campos previstos mudaram; ofertas/planos/pedidos/acessos existentes permanecem equivalentes. Verificar login, home e material real de avulso, sem realizar pagamento falso. Relatório distingue validação por fixture de compra real observada; não prometer automação comercial comprovada sem evento real.
- [ ] Se houver regressão, restaurar modo da loja, visibilidades, relações e URLs de imagens do snapshot anterior, com checagem de concorrência. Manter migration aditiva, conteúdo, compras e produtos já vendidos. Não desfazer pedidos ou apagar entregas legítimas. Invalidar cache de Store/rotas após ativação ou reversão.
- [ ] Entregar resumo final com versão, cenários verificados, artes utilizadas, produtos publicados ou pendentes e localização das evidências. Não criar monitoramento recorrente nem enviar campanhas como consequência desta entrega.

## Cobertura e revisão do plano

| Requisito da spec | Tarefas responsáveis |
|---|---|
| Identidade Netflix e descoberta de principais | 3, 7, 9 |
| Agrupamento, avulso, vários principais e continuidade | 3, 4, 7 |
| Conteúdo/bonificações/níveis e ofertas internas | 4, 7, 9 |
| Capas 2:3 / imagens 1:1 e seis artes | 8, 9 |
| Dados, admin, concorrência, importador | 2, 5, 6 |
| Acesso independente, Payt, Protocolo e links antigos | 1, 3, 4, 7, 9 |
| Prontidão, PDFs e Mestres do Paisagismo | 8, 10 |
| Falhas, acessibilidade, mobile e isolamento | 2–7, 9 |
| Aplicação aditiva, snapshots e reversão | 1, 10 |

Revisão inline: contratos compartilhados nomeados; novas migrations sem seed; cinco riscos de Review Focus possuem testes nas tarefas indicadas; dependência da base publicada e pendência do material Mestres explicitadas. Nenhum teste de runtime foi executado ao preparar este documento: seus comandos são passos futuros.

## Handoff de execução

Recomendação: execução nativa nesta conversa, mantendo as tarefas sequenciais e uma revisão independente da alteração completa ao final. Banco, importador e apresentação compartilham interfaces; concentrar a implementação reduz desencontros. Se preferido, execução por subagentes usa implementador e revisor novos por tarefa, com maior custo de contexto e mais revisões intermediárias.

Após o usuário revisar este plano e escolher o método, aplicar a skill correspondente. A aprovação da especificação já está preservada; não rediscutir o visual nem os formatos de capa.

## Registro da execução — 24/10/2026

Execução nativa autorizada posteriormente nesta conversa, com revisão independente final. Implementação e preparação local registradas em [relatorio.md](../../qa/complementos-contextuais/relatorio.md); achados/correções em [revisao.md](../../qa/complementos-contextuais/revisao.md). Os checklists acima preservam o plano aprovado; a evidência executada e as pendências de ativação estão nesses relatórios. Nenhuma publicação ou alteração comercial em produção foi realizada.
