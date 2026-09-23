# Aula e downloads — Implementation Plan

> **For agentic workers:** Use subagent-driven-development com TDD e revisão; executar sem novas perguntas conforme autorização do usuário. Sem commit, push ou deploy.

**Goal:** Capa abre conteúdo interno com downloads em um clique e links externos claros, mantendo a identidade atual.

**Architecture:** Reutilizar products/modules/items. Produto mostra arquivos/links em linhas de recursos agrupadas por módulo e mantém vídeos como aulas. Página de item vira página interna para todos os tipos; vídeos conservam player. Links de recursos usam uma rota protegida `/{loja}/item/{id}/abrir`, que valida acesso, registra abertura e redireciona ao destino, sem transportar bytes. Supabase público configurado recebe parâmetro `download`; URLs externas ficam intactas.

**Tech Stack:** Next.js 16.3.5 App Router, React19, Tailwind existente, Supabase, Vitest, agent-browser.

**Spec:** Pedido do usuário de 23/09/2026 e imagens Payt como referência funcional somente. Escopo delimitado ao fluxo de materiais já existente. Aprovação e execução autônoma explicitamente delegadas pelo usuário.

## Design

Manter tokens atuais: padrão fundo #0b0b0c, superfície #141414, borda #2a2a2e, texto #f5f5f5, suave #a1a1aa, destaque #e11d2e; arquitetura herda fundo #111214, superfície #1c2024, borda #434b54, destaque #ff5a16 e ação #ffd53d. Reutilizar Inter e Barlow Condensed existentes, sem novas fontes. Cabeçalho/capa/hierarquia do produto preservados. Lista vertical espaçosa com título que quebra linha, identificação Arquivo/Link externo, FileIcon/LinkIcon e ação à direita. DownloadIcon desloca suavemente para baixo no hover/foco, desativado com reduced-motion. Evitar pills gigantes, cores Payt e tamanhos MB inventados. Mobile com alvo confortável e sem overflow.

```text
Capa do produto → nome + descrição existente
  [Aulas em vídeo, se existirem]
  Downloads e links
  [ícone] Nome do material              [Baixar ↓]
  [ícone] Versão editável              [Abrir link ↗]
```

## Global Constraints

- Preservar upload direto já implementado (copiado para este worktree), campos atuais, nomes e valores de kind arquivo/video/link, permissões e isolamento de lojas.
- Sem schema/migrações, novas dependências, alteração de visibilidade, email/webhook ou proxy de bytes.
- O atributo download sozinho não força download cross-origin: para nosso Supabase público usar ?download, conforme https://supabase.com/docs/guides/storage/serving/downloads.
- Validar origem exata do Supabase configurado e prefixo /storage/v1/object/public/arquivos/ antes de acrescentar download; não tocar query de URLs externas ou kind link.
- Redirecionamento externo permitido apenas para http/https do item autorizado; nunca URL arbitrária vinda de query do visitante.
- Não mostrar URLs de materiais ocultos, outra loja ou produto não comprado; preservar navegação vídeo/anterior/próximo.
- Sem novas perguntas ou publicação. Mudanças preexistentes preservadas e arquivos desta entrega integrados à pasta original ao final.

## Review Focus

- Download e abertura externa devem passar pela mesma autorização/publicação do item, inclusive no endpoint direto.
- Uma URL parecida com Supabase em host estranho não deve ser reescrita; query externa mantida.
- Página sem recursos, título muito longo e módulo misto vídeo/arquivo/link não quebram a navegação.
- Foco, nomes acessíveis das ações e reduced motion; links externos indicam nova aba.
- Não fazer download/prefetch ao apenas renderizar a lista; registro ocorre no clique autenticado da rota abrir.

### Task 1: fluxo completo de recursos

**Files:** novo src/lib/content/resource.ts; novo src/app/[loja]/item/[id]/abrir/route.ts; novo src/components/membros/resource-list.tsx; modificar src/components/membros/episode-card.tsx, src/app/[loja]/produto/[slug]/page.tsx, src/app/[loja]/item/[id]/page.tsx; CSS restrito à nova lista em src/app/globals.css somente se classes existentes não bastarem; src/app/admin/(painel)/produtos/item-fields.tsx e content-editor.tsx apenas para orientações de cadastro; tests/membros/content-routes.test.ts, novo tests/membros/resources.test.ts, novo tests/membros/resource-open.test.ts e testes admin existentes conforme necessário.

**Interfaces:** getResourceDestination(item: Pick<Item,'kind'|'url'>, supabaseUrl: string): string | null. Null para vídeo/URL inválida, URL intacta para link/arquivo externo, ?download para arquivo no bucket configurado. ResourceList({items: Item[], storeSlug: string, currentItemId?: string}) renderiza somente tipos arquivo/link com URL http(s) válida, links HTML para rota abrir sem prefetch. Rota GET recebe params Promise<{loja,id}>.

- [x] Ler guias Next locais route handlers, Link e fronteira server/client antes de código.
- [x] Escrever testes antes da implementação: helper força download somente origem/bucket corretos, preserva query externa e kind link; rota recusa sem sessão/sem compra/outra loja/ocultos/uuid inválido, espera recordItemAccess e redireciona sem fetch de arquivo; lista mostra nome/ações sem href direto; ItemAnchor todos os tipos navegam internamente na mesma aba; ItemPage arquivo/link renderiza conteúdo em vez de redirect. Atualizar antiga expectativa de redirect não vídeo para nova UX, preservando testes de autorização existentes.
- [x] Rodar testes focados e registrar RED (ausência/antigo comportamento), depois implementar o menor fluxo completo.
- [x] Rota abrir replica guardas da página de item, retorna 404 para vídeo/destino inválido e usa redirect apenas após registro. Não usar fetch do arquivo. Dados de acesso seguem servidor.
- [x] Produto: lista de downloads/links agrupada pelo módulo, vídeos continuam acessíveis por capa. Item: título, link voltar ao produto, player se vídeo e lista de recursos publicados do módulo. Exibir item atual primeiro ou destacado na lista, sem duplicar sua ação fora da lista. Irmãos vídeo permanecem na navegação.
- [x] Admin: manter inputs kind/title/url e upload. Deixar explícito Arquivo para download, Vídeo e Link externo; texto de ajuda explica título como nome visível, usar Link externo para Drive/site/versão editável e usar itens do mesmo módulo para reunir recursos. Não condicionar funcionamento de URL ao upload. Sem mudanças na action salvarItem.
- [x] GREEN de testes focados, tsc (next typegen se preciso) e lint nos arquivos tocados. Relatório em .superpowers/sdd/aula-downloads/implementation.md. Não repetir suíte completa a cada edição.

### Task 2: QA e revisão

- [x] Em paralelo à implementação, preparar fixture local e agent-browser (Next real/REST fake) com sessão de aluno, catálogo, compra, dois arquivos, link externo e vídeo. Somente scratch .superpowers/sdd/aula-downloads/browser; sem alterar produção.
- [x] Testar clique capa → produto, página de item interna, download de arquivo via rota autorizada com Content-Disposition attachment na fixture, link externo, 390px/desktop, outra loja e tema arquitetura, hover/reduced-motion e sem erros JS.
- [x] Revisão independente de conformidade/qualidade, correção de problemas com RED/GREEN quando comportamental.
- [x] Integrar somente delta desta tarefa no workspace original após hashes confirmarem ausência de alterações concorrentes.
- [x] Rodar npm test, npx tsc --noEmit e npm run lint na pasta original; relatar resultados reais, avisos preexistentes e limites de providers externos.
