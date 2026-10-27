# Acesso à compra discreto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implementar o piloto discreto aprovado dentro da compra, com acesso claro ao principal e complementos e linguagem de produto.

**Architecture:** Projeção pura e reutilizável de navegação baseada no agrupamento e nas concessões existentes. Componentes internos consomem um modelo serializável; URLs de abertura, módulos, permissões e home permanecem no fluxo atual. Opção de carrossel opt-in evita efeitos na home.

**Tech Stack:** Next.js 16.3.5, React 19.2.8, TypeScript, Tailwind, Vitest, happy-dom, Vercel agent-browser 0.38.1.

**Spec:** `docs/superpowers/specs/2026-10-26-acesso-compra-discreto.md`

## Global Constraints

- Manter a página inicial exatamente como está: hero, catálogo, Continuar, Meus materiais, agrupamento, estilos e comportamento dos carrosséis da home.
- Alterar somente a apresentação e navegação internas da compra; não modificar Payt, pedidos, concessões, autenticação, armazenamento ou cadastros.
- Preservar a identidade atual: título condensado, faixa de acesso, coluna lateral, capas de complementos e ofertas separadas.
- Mostrar somente produtos adquiridos, publicados e da mesma loja na navegação da compra; respeitar a prévia editorial existente.
- Preservar os módulos, níveis Básico/Completo, progresso e sequência do produto atual; associação não concede acesso.
- Preservar parâmetros de prévia e de cenário nos links internos.
- Usar Atlas, Guia ou Material digital conforme o nome; não exibir PDF/PDFs em rótulos gerados para o membro. Não alterar URLs, extensões, MIME nem textos internos dos entregáveis.
- Não fixar nomes, slugs, IDs, quantidade de arquivos ou bônus de um produto no código. A contagem de links não representa a quantidade de materiais dentro de uma pasta.
- Usar Vercel agent-browser para a validação de frontend, em ambiente local com dados sintéticos.
- Não publicar, fazer push ou migrar dados como parte desta implementação.

## Review Focus

1. Complemento aberto por link direto deve mostrar o mesmo principal e irmãos adquiridos da rota de produto (tarefas 1 e 2).
2. Principal reembolsado, oculto, de outra loja ou relação removida não pode aparecer nem bloquear o complemento avulso (tarefas 1 e 2).
3. Vários módulos/vídeos e níveis não devem perder navegação, progresso ou restrições ao adicionar atalhos (tarefa 2).
4. Títulos longos e três ou mais complementos devem quebrar linhas sem esconder atalhos no celular; cards e carrosséis da home permanecem idênticos (tarefa 2, browser).
5. URL codificada, formato editável e título sem Atlas/Guia não podem induzir rótulo incorreto; formato técnico continua intacto (tarefa 1).

## Mapa de arquivos

Projeção nova: `src/lib/membros/purchase-navigation.ts`. Apresentação de recursos: `src/lib/content/member-resource-label.ts`. Componente novo: `src/components/membros/purchase-navigation.tsx` e CSS de escopo local, se necessário. Integração: `item-content.tsx`, `lesson-sidebar.tsx`, `resource-list.tsx`, `material-help.tsx`, `contextual-complement-shelves.tsx`, `carousel.tsx`, rota de produto. Não editar componentes da home nem projeções de retomada/agrupamento existentes.

### Task 1: Projeção segura e nomes dos materiais

**Files:**
- Create: `src/lib/membros/purchase-navigation.ts`
- Create: `src/lib/content/member-resource-label.ts`
- Test: `tests/membros/purchase-navigation.test.ts`
- Test: `tests/membros/member-resource-label.test.ts`

**Interfaces:**
- Consumes: `ContextualInput`, `projectContextualLibrary(input)`, `PreviewContext`, `withPreview(path, preview, scenario)`, `resourceLabel(item)` existentes.
- Produces:
```ts
export type PurchaseNavigation = {
  products: { id: string; title: string; href: string; current: boolean; role: 'principal' | 'complemento' }[]
  backParent: { title: string; href: string } | null
}
export function buildPurchaseNavigation(input: ContextualInput, currentProductId: string, storeSlug: string, preview?: PreviewContext, complementScenario?: string): PurchaseNavigation | null
export function memberResourceLabel(item: Pick<Item, 'kind' | 'url' | 'title'>, productTitle?: string): { typeLabel: string; actionLabel: string }
```

- [x] **Step 1: Escrever testes de comportamento antes do código.** Usar `product` e `relation` de `tests/fixtures/contextual-products`.
```ts
const input = { storeId: 's1', products: [product('atlas'), product('guia'), product('extra')], relations: [relation('atlas', 'guia'), relation('atlas', 'extra')], granted: new Set(['atlas', 'guia']) }
expect(buildPurchaseNavigation(input, 'guia', 'arquitetura')?.products.map(p => p.id)).toEqual(['atlas', 'guia'])
expect(buildPurchaseNavigation(input, 'guia', 'arquitetura')?.backParent?.href).toBe('/arquitetura/produto/atlas')
expect(buildPurchaseNavigation({...input, granted: new Set(['guia'])}, 'guia', 'arquitetura')).toBeNull()
expect(buildPurchaseNavigation(input, 'extra', 'arquitetura')).toBeNull()
expect(memberResourceLabel({kind:'arquivo', title:'Guia de Plantio', url:'https://example.test/guia%2EPDF'}, 'Atlas Tropical')).toEqual({typeLabel:'Guia', actionLabel:'Abrir Guia'})
```
Acrescentar principal e irmãos (todos adquiridos), não publicado/foreign/relação removida, relações repetidas, pai compartilhado determinístico, includeDrafts, links com simular/complementos, fonte imutável. Nomes: Atlas no título, Guia no título tem prioridade sobre produto Atlas, título genérico usa produto, nenhum dos dois usa Material digital, PDF query-only não inventa formato, URL inválida mantém fallback, DWG/SKP/XLSX preservados.

- [x] **Step 2: Executar RED.** `npx vitest run tests/membros/purchase-navigation.test.ts tests/membros/member-resource-label.test.ts`; falha esperada por módulos ausentes. Guardar saída no relatório.

- [x] **Step 3: Implementar helpers.** Não modificar a projeção existente. Usar o grupo de `projectContextualLibrary(input).owned` que contém currentProductId; retornar null se não existir ou contiver menos de dois produtos. Construir `[group.product, ...group.complements]` com URLs codificadas e `withPreview`. Marcar somente atual; backParent somente quando atual não é principal. Isso reutiliza a seleção determinística da home sem alterá-la.
```ts
const projection = projectContextualLibrary(input)
const group = projection.owned.find(g => g.product.id === currentProductId || g.complements.some(p => p.id === currentProductId))
if (!group || group.complements.length === 0) return null
```
`memberResourceLabel` chama `resourceLabel` para detecção existente; somente o rótulo PDF é convertido. Reconhecer `/\batlas\b/i` e `/\bguias?\b/i` primeiro em item.title e depois productTitle. Sem identificação retornar Material digital / Abrir material. Links, vídeos e formatos editáveis preservam rótulos e ações existentes. Não converter URLs ou conteúdos. Não criar contagens de arquivos.

- [x] **Step 4: Executar GREEN e regressões.** `npx vitest run tests/membros/purchase-navigation.test.ts tests/membros/member-resource-label.test.ts tests/access/contextual-complements.test.ts tests/membros/resource-label.test.ts`.
- [x] **Step 5: Self-review, relatório e commit.** Commit somente os quatro arquivos próprios: `feat: add owned purchase navigation and member material labels`. Relatar RED/GREEN e interface final; não executar subagentes.

### Task 2: Integrar navegação e refinar a interface existente

**Files:**
- Create: `src/components/membros/purchase-navigation.tsx`
- Create if useful: `src/components/membros/purchase-navigation.module.css`
- Modify: `src/components/membros/item-content.tsx`
- Modify: `src/components/membros/lesson-sidebar.tsx`
- Modify: `src/components/membros/resource-list.tsx`
- Modify: `src/components/membros/material-help.tsx`
- Modify: `src/components/membros/contextual-complement-shelves.tsx`
- Modify: `src/components/membros/carousel.tsx`
- Modify: `src/app/[loja]/produto/[slug]/page.tsx`
- Test: `tests/membros/purchase-navigation-ui.test.ts`, `tests/membros/carousel-overflow.test.ts`, `tests/membros/contextual-product-routes.test.ts`, `tests/membros/item-content-complement.test.ts`, `tests/membros/resource-list.test.ts` (criar se necessário)

**Interfaces:**
- Consumes: helpers e tipos exatos da tarefa 1.
- Produces: optional `purchaseNavigation?: PurchaseNavigation | null` em LessonSidebar; optional `productTitle?: string` em ResourceList; optional `purchaseNavigation?: boolean` em MaterialHelp; optional `controls?: 'always' | 'overflow'` em Carousel, padrão `always`.

- [x] **Step 1: Escrever testes RED de renderização e interação.** Usar renderToStaticMarkup/Window como testes existentes; para resize, montar componente React e ResizeObserver controlado no happy-dom.
```ts
const nav = buildPurchaseNavigation(input, 'guia', 'arquitetura', 'complete', 'one')!
const markup = renderToStaticMarkup(createElement(PurchaseNavigationLinks, { navigation: nav }))
const document = new Window().document
document.body.innerHTML = markup
expect(document.querySelector('[aria-current="page"]')?.textContent).toContain('guia')
expect(document.querySelectorAll('a')).toHaveLength(2)
for (const a of document.querySelectorAll('a')) expect(a.href).toContain('complementos=one')
```
Adaptar fixtures para títulos reais reconhecíveis. Cobrir links adquiridos/ausentes, estado atual, retorno nomeado, rota sem itens, módulos múltiplos, Básico/Completo, recurso Guia sem texto PDF, fallback legacy, carrossel padrão com controles e opt-in com/sem overflow após resize. Controles devem voltar quando cresce conteúdo e sumir quando não há overflow. Não testar apenas texto do código.

- [x] **Step 2: Rodar os testes novos e registrar falhas previstas.** `npx vitest run tests/membros/purchase-navigation-ui.test.ts tests/membros/carousel-overflow.test.ts tests/membros/contextual-product-routes.test.ts tests/membros/item-content-complement.test.ts tests/membros/resource-list.test.ts`.

- [x] **Step 3: Integrar UI sem substituir o layout.** Antes de editar, ler guias locais de Next `use-client.md`, `link.md` e craft-floor do Impeccable. Em renderItemContent calcular navegação com input existente; não buscar módulos de outros produtos. Passar modelo ao sidebar. Usar componente de links sem estado para ambos desktop/mobile, com o título completo e `aria-current="page"`, rótulo de papel e “Você está aqui” / “Adquirido · Acessar material”. Coluna existente chama-se “Conteúdos da compra” somente com grupo. Atalhos ficam fora do details recolhido no mobile. Se houver um único módulo com um único recurso, o atalho atual substitui a lista redundante; nos demais casos manter módulos existentes sob a navegação. Preservar upgrade e legacy complement.
```tsx
{navigation.products.map(p => <Link key={p.id} href={p.href} aria-current={p.current ? 'page' : undefined}>
  <span>{p.title}</span><small>{p.current ? 'Você está aqui' : 'Adquirido · Acessar material'}</small>
</Link>)}
```
Retorno com texto visível “Voltar para {parent.title}” quando houver pai; caso contrário “Voltar aos meus materiais”. Respeitar o estilo da seta existente, sem header gigante novo. Aplicar também à rota sem itens. Ajuda adiciona orientação contextual sem substituir mensagens técnicas úteis. ResourceList usa `memberResourceLabel(item, productTitle)` sem mudar destinos/target/rel.

- [x] **Step 4: Ajustar somente fileiras internas.** Título “Seus complementos adquiridos”, status “Adquirido”, link textual “Acessar material” por produto. Carousel mantém padrão antigo; com `controls="overflow"`, medir `scrollWidth > clientWidth + 1`, observar resize de track/conteúdo e limpar listeners/observer. Ativar apenas nas fileiras ContextualComplementShelves, não home.
```tsx
<Carousel title="Seus complementos adquiridos" controls="overflow">{children}</Carousel>
```
Sem inventar quatro guias: manter título cadastrado “Atlas completo + 3 bônus” quando existir. Não acrescentar lista hardcoded dos bônus do piloto.

- [x] **Step 5: GREEN, verificação de escopo e commit.** Rodar todos testes de membros e acesso relevantes; `git diff --check`. Verificar ausência de alterações em home (`src/app/[loja]/page.tsx`, contextual-library-home, owned-product-group, contextual-library.ts e CSS global). Salvar relatório e commit `feat: clarify acquired materials inside purchase pages`.

## Validação integrada pelo controlador

- [x] Registrar baseline da suíte e home antes da integração; comparar textos, links, layout e screenshot no mesmo cenário.
- [x] `npm test -- --maxWorkers=2 --testTimeout=20000`, `npm run lint`, `npm run build`, `git diff --check`.
- [x] Fixture: `node scripts/qa-contextual-complements-fixture.mjs --app`; localhost 3180 e 54329, nenhuma credencial real.
- [x] Vercel Agent Browser em sessão própria: login sintético, Atlas → Guia → Atlas, link direto do Guia, abertura simulada de material; screenshots 1440/390/320 e nenhuma rolagem horizontal.
- [x] Cenários one/zero/all/solo/refund-parent/refund-complement/draft-parent e prévia complete + one; conferir que não aparecem produtos não adquiridos como adquiridos e que avulso continua acessível.
- [x] Revisão independente final do intervalo desde 611aac7. Relatório e evidências em `docs/qa/acesso-compra-20261026/`; commit de documentação. Não publicar.

## Auto-revisão e execução

Plano revisado contra o piloto aprovado: nenhuma mudança da home; helpers sem impacto antes da integração; efeitos de carrossel opt-in; nomes independentes de formato; quantidades desconhecidas não inventadas. Os cinco riscos possuem testes na tarefa proprietária. Execução com subagentes já escolhida pelo usuário; a revisão delegada está concluída e não requer nova confirmação.
