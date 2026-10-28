# Meus materiais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a biblioteca aprovada com capas de complementos adquiridos lado a lado, preservando três ofertas de Prática Profissional.

**Architecture:** Reutilizar `projectContextualLibrary`, sua seleção de compras e sua ordenação. `OwnedProductGroup` passa a renderizar um fragmento de capas individuais. A home agrupada remove os blocos redundantes; a rota evita buscar histórico quando a biblioteca é agrupada.

**Tech Stack:** Next.js 16.4.3, React 19.2.8, TypeScript, Vitest, Supabase existente, Vercel, Vercel agent-browser.

**Spec:** `docs/superpowers/specs/2026-10-28-meus-materiais-design.md`

## Global Constraints

- Trabalhar a partir da produção e189232843f47771476fd77c231152e5606cbe5b em branch isolada.
- Salvar backup antes de modificar código; registrar deployment anterior e rollback antes de publicar.
- Usar `catalogVisibility` e vínculos existentes; não alterar pedidos, liberações, Payt, esquema ou credenciais de clientes.
- Os três produtos Kit Captação e Atendimento de Clientes, Orçamento de Obras na Prática e Kit Gestão de Obras permanecem com `catalog_visibility=catalog` e categoria Prática Profissional.
- Os nove demais order bumps atuais permanecem com `catalog_visibility=contextual`; não aparecem no catálogo geral.
- Preservar o comportamento de descoberta existente: produtos já adquiridos ficam em Meus materiais; ofertas não adquiridas aparecem nas categorias conforme sua configuração.
- Aplicar a todas as frentes da loja em modo agrupado; lojas no modo legado mantêm a interface atual.
- Testar frontend com Vercel agent-browser em desktop e mobile, sem compras, e-mails ou alterações em clientes reais.

## Review Focus

1. Complemento avulso ou relações indisponíveis: compra continua acessível (Task 1).
2. Vários principais e complemento compartilhado: cada compra aparece uma vez, junto do principal selecionado pela projeção (Task 1).
3. Prévia basic/complete e cenário one/all/solo: links preservam os parâmetros de simulação (Task 1).
4. Exceções de catálogo: qualquer produto configurado catalog segue aparecendo se não adquirido; contextual continua escondido (Task 1).
5. Histórico antigo com visitas: não recria Continuar nem causa consulta de histórico na biblioteca agrupada (Task 1).

## File Structure

- `src/components/membros/owned-product-group.tsx`: capas individuais do grupo, sem contêiner que reduza suas larguras.
- `src/components/membros/contextual-library-home.tsx`: composição das seções agrupadas.
- `src/app/[loja]/page.tsx`: busca de histórico apenas para lojas legadas.
- `tests/membros/contextual-library.test.ts`: DOM, links e proporções estruturais dos cards.
- `tests/membros/contextual-product-routes.test.ts`: integração da home, prévias, histórico e visibilidade.
- `tests/access/contextual-complements.test.ts`: garantir múltiplos principais/deduplicação se a cobertura atual não comprovar esses casos.
- `docs/status-publicacao-meus-materiais-2026-10-28.md`: resultado, backup, deployment e limites reais da validação.

### Task 1: Implementar biblioteca aprovada e regressões

**Files:** modificar os cinco arquivos de componentes/rota/testes acima; ampliar o teste de acesso somente se necessário.

**Interfaces:** Consome `OwnedGroup {product:Product; complements:Product[]}`, `projectContextualLibrary(ContextualInput)` e `withPreview(path, preview, scenario)`. Preserva a assinatura pública de OwnedProductGroup. `renderContextualHome` deixa de consumir histórico e níveis não usados; a rota mantém níveis para o caminho legado.

- [ ] **Step 1: Atualizar testes antes do código**

Em `contextual-library.test.ts`, substituir o teste antigo de details por:

```ts
const html=renderToStaticMarkup(createElement(OwnedProductGroup,{group:{product:atlas,complements:[guia]},storeSlug:'arq',preview:false}))
const doc=new Window().document;doc.body.innerHTML=html
expect(doc.querySelector('details')).toBeNull()
expect([...doc.querySelectorAll('a')].map(a=>a.getAttribute('href'))).toEqual(['/arq/produto/atlas','/arq/produto/guia'])
expect(doc.body.children).toHaveLength(2)
expect(doc.querySelectorAll('img')).toHaveLength(2)
```

Verificar também com preview `complete` e scenario `all` que ambos os links terminam em `?previa=1&simular=complete&complementos=all`. Na integração da home, inspecionar DOM da seção `aria-label="MEUS MATERIAIS"`, contar links de principal/complemento, rejeitar `details`, `Continuar`, `Tudo pronto para você criar`, `Explore outros produtos`. Tornar `listRecentProductVisits` um mock espiável e exigir zero chamadas no caminho agrupado. Manter os casos existentes de avulso, relações ausentes e compra contextual. Acrescentar produto orderbump com `catalogVisibility:'catalog'`, categoria Prática Profissional, não adquirido, e exigir presença na categoria; contextual opcional permanece ausente. Exercitar vários principais com as mesmas regras e complementar compartilhado sem duplicata usando fixtures `product`/`relation` existentes.

- [ ] **Step 2: Demonstrar RED**

```powershell
npx vitest run tests/membros/contextual-library.test.ts tests/membros/contextual-product-routes.test.ts tests/access/contextual-complements.test.ts
```

Esperar falhas específicas: details ainda presente, título antigo e consulta de histórico.

- [ ] **Step 3: Implementar mínimo**

```tsx
export function OwnedProductGroup({group,storeSlug,preview,complementScenario}:{group:OwnedGroup;storeSlug:string;preview:PreviewContext;complementScenario?:string}){
  return <>{[group.product,...group.complements].map(product=><PosterLink
    key={product.id}
    product={{...product,unlocked:true}}
    href={withPreview(`/${storeSlug}/produto/${product.slug}`,preview,complementScenario)}
  />)}</>
}
```

Usar o tipo completo já existente, remover imports Link/styles/POSTER_WIDTH tornados obsoletos. Na home remover `projectContextualResume`, `contextualPreviewLevel`, RecentProductVisitWithAccess, AccessLevel e CSS se não mais utilizados, seus cálculos e props correspondentes. Alterar Carousel para `title="MEUS MATERIAIS"`. Remover os dois cabeçalhos redundantes e o Carousel Continuar. Preservar suporte, empty state, banner, ofertas contextuais e tracks. Na rota:

```ts
customer && store.memberLibraryMode !== 'grouped'
  ? listRecentProductVisits(customer.id, store.id).catch(() => [])
  : Promise.resolve([])
```

Na chamada agrupada passar somente `store,customer,products,granted,preview,query`. Não mudar o caminho legado nem a projeção de autorização.

- [ ] **Step 4: Demonstrar GREEN e validar**

```powershell
npx vitest run tests/membros/contextual-library.test.ts tests/membros/contextual-product-routes.test.ts tests/access/contextual-complements.test.ts tests/membros/contextual-preview.test.ts tests/membros/carousel.test.ts
npm run lint
```

Registrar comandos e resultados no relatório; corrigir asserções antigas somente quando refletirem apresentação explicitamente substituída.

- [ ] **Step 5: Commit e revisão independente**

Adicionar apenas arquivos desta tarefa e commit `feat: show acquired complements alongside member materials`. Criar pacote de diff contra o BASE registrado e obter vereditos de conformidade e qualidade. Corrigir achados pelo implementador com testes focados e nova revisão.

### Task 2: Validar release e publicar

**Files:** `docs/status-publicacao-meus-materiais-2026-10-28.md`, evidências em `artifacts/qa-meus-materiais-20261028`, backup preexistente na pasta original `artifacts/backup-meus-materiais-20261028`.

**Interfaces:** Consome commit revisado da Task 1; produz deployment READY para `members.grupoelevamax.com` e rollback para o deployment registrado no backup.

- [ ] **Step 1: Conferir backup e código de base**

```powershell
Get-FileHash -Algorithm SHA256 'C:/Users/arqal/OneDrive/Desktop/Ideias Low Ticket/Area de membros/artifacts/backup-meus-materiais-20261028/production-source-e189232.tar'
git diff --stat e189232843f47771476fd77c231152e5606cbe5b
```

Salvar configuração de apresentação da loja/produtos/relações com consulta somente leitura. Não alterar dados já corretos. Registrar identificador do deployment atual via API autenticada/CLI oficial.

- [ ] **Step 2: Testes finais**

```powershell
npm test -- --testTimeout=30000
npm run build
```

Usar variáveis locais existentes sem mostrá-las em logs. Se a suíte revelar falha preexistente, comparar com a base e documentar antes de decidir. Não ignorar regressões.

- [ ] **Step 3: QA visual**

Usar binário instalado do Vercel agent-browser, sessão exclusiva, `--help` para comandos. Abrir app local autenticado ou preview protegido e testar 1440×1000 e 390×844, mais largura 320px. Cenários all/one/solo/locked; todas as frentes no cenário all. Exigir capas carregadas, ausência de overflow da página, carrossel funcional, links individuais corretos, nenhum bloco Continuar, categoria Prática Profissional com três ofertas na prévia locked e nenhum dos nove bumps contextuais no catálogo. Salvar capturas e resultados. Não simular pagamento nem baixar PDF de cliente.

- [ ] **Step 4: Revisão final e deploy**

Revisor final independente revisa diff completo contra e189232 e evidências de backup/testes. Após aprovação, push normal da branch e publicação pelo fluxo Vercel/GitHub existente autorizado. Não forçar push. Confirmar o domínio aponta ao novo deployment e que está READY; repetir QA visual essencial na produção e verificar redirecionamento de visitante sem sessão.

- [ ] **Step 5: Registrar entrega**

Escrever status com commits, testes, capturas, backup, deployment anterior/novo e comando de rollback confirmado por `vercel rollback --help`. Encerrar sessão QA e preservar o worktree com evidências até integração e recuperação estarem asseguradas.

## Self-review

Todas as restrições possuem tarefa; nomes de interfaces vêm dos arquivos da produção. A lista das três exceções pertence aos dados já configurados, não ao código. Aprovação e método de execução foram fornecidos explicitamente pelo usuário; continuar após autorrevisão, sem novo gate humano.
