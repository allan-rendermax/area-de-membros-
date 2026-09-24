# Validação do cadastrador de produtos
Data: 2026-09-24. Branch local: codex/cadastrador-produtos.

## Resultado verificado
- npm test: 68 arquivos, 561 testes passaram, saída 0 (commit de código 06786aa).
- npm run lint: saída 0, nenhum erro. Um aviso preexistente em scripts/trocar-admin-e-aluno.mjs:20 (loja não usada).
- npm run build: Next.js 16.3.5/Turbopack compilou, TypeScript passou e 8 páginas estáticas foram geradas; saída 0.
- node scripts/cadastrar-produto.mjs "docs/exemplo-pasta-produto" --simular: saída 0; 1 produto, 2 módulos, 3 itens, 91 B.
- node scripts/cadastrar-produto.mjs "docs" --todos --simular: saída 0; ignorou entradas sem ficha e validou o mesmo exemplo.
- git diff --check: sem erros.
- scripts/cadastro-atlas-patologias.mjs: nenhuma alteração em relação à base b1c8252.

O Vitest mantém o aviso preexistente sobre futura configuração nativa do Vite e formato CommonJS de vitest.config.ts. O primeiro build no worktree falhou porque o Turbopack recusou a junction de node_modules; a junction foi substituída por dependências locais via npm ci, e o comando normal npm run build passou.

## Frontend e testes
O [relatório do agent-browser](qa/cadastrador-produtos/browser-report.md) reúne quatro capturas, ambiente reproduzível e resultados: criação, alteração e persistência do papel; checkout obrigatório em produto complementar; ordem da vitrine e produtos ocultos; desktop/mobile sem estouro horizontal do documento; nenhum erro de página. Usa aplicação real contra Supabase simulado local, com todas as gravações somente em memória.

Testes de unidade e integração local verificam leitura de ficha, descrição multilinha, acentos, arquivos soltos, prefixos, links, MIME, colisões, links simbólicos, limite das ordens do PostgreSQL, migration com PGlite, passagem do formulário para persistência, destaque preservado, preflight do lote inteiro, erros de consulta, conflito Payt, paginação e reexecução sem duplicatas. Um teste usa o SDK Supabase instalado com fetch simulado para verificar URLs de arquivos com pontuação, sem acesso à rede.

Supabase e Payt de produção não foram usados para cadastrar dados ou testar compras. Nenhuma migration foi aplicada. Não houve push nem deploy. O funcionamento externo definitivo depende da migration e da configuração real; o executor já verifica o esquema antes de enviar.

## Aplicar a migration
No painel Supabase, selecione o projeto correto, abra **SQL Editor → New query**, copie o conteúdo de **supabase/migrations/20260924000001_product_role.sql** e clique **Run**, uma única vez:

```sql
alter table public.products add column role text not null default 'front'
  check (role in ('front', 'orderbump', 'upsell'));
```

Aplique antes de publicar esta versão ou executar cadastro real. Os produtos existentes recebem front. O arquivo SQL foi deixado pronto, sem execução remota.

## Uso
A partir da raiz deste worktree:

```powershell
node scripts/cadastrar-produto.mjs "docs/exemplo-pasta-produto" --simular
```

Para preparar a pasta real, siga [como-cadastrar-produto.md](como-cadastrar-produto.md). O exemplo usa loja/código fictícios e serve para simulação.

## Decisões tomadas
- Orderbump e upsell compartilham prioridade; o desempate é sort_order. Uma preferência diferente exige mudar o comparador.
- Código Payt vinculado a outro produto e slug compartilhado entre lojas são recusados, preservando vínculos e arquivos. Em caso de conflito o dono precisará escolher outro código/slug ou revisar os registros.
- Subpastas além de um nível e links simbólicos são recusados. Pastas com essa estrutura precisam ser reorganizadas antes do cadastro.

O cadastro preserva itens e módulos extras. Renomear títulos cria novos registros e relata os antigos; remoção automática não faz parte do fluxo. Execute um processo por vez. Storage e banco não formam uma transação única; falhas de rede exigem reexecutar após corrigir a causa.

## Arquivos
A lista abaixo usa A para criado e M para alterado.

```text
A	docs/como-cadastrar-produto.md
A	docs/exemplo-pasta-produto/entregaveis/01 Guias/01 Leia primeiro.txt
A	docs/exemplo-pasta-produto/links.txt
A	docs/exemplo-pasta-produto/produto.txt
A	docs/qa/cadastrador-produtos/admin-edit-desktop.png
A	docs/qa/cadastrador-produtos/admin-form-desktop.png
A	docs/qa/cadastrador-produtos/browser-fixture.mjs
A	docs/qa/cadastrador-produtos/browser-report.md
A	docs/qa/cadastrador-produtos/member-shelf-desktop.png
A	docs/qa/cadastrador-produtos/member-shelf-mobile.png
A	docs/superpowers/plans/2026-09-24-cadastrador-produtos.md
A	docs/superpowers/specs/2026-09-24-cadastrador-produtos-design.md
A	docs/superpowers/specs/cadastro-proposta-original.txt
A	scripts/cadastrar-produto.mjs
A	scripts/lib/cadastro-executor.mjs
A	scripts/lib/cadastro-pasta.mjs
A	scripts/lib/cadastro-plano.mjs
M	src/app/admin/(painel)/produtos/product-form.tsx
M	src/lib/access/access.ts
M	src/lib/admin/forms.ts
M	src/lib/data/products-admin.ts
M	src/lib/data/products.ts
M	src/lib/domain/types.ts
A	supabase/migrations/20260924000001_product_role.sql
M	tests/access/shelf.test.ts
M	tests/access/tracks.test.ts
M	tests/admin/forms.test.ts
M	tests/admin/offer-persistence.test.ts
A	tests/admin/product-role-persistence.test.ts
A	tests/admin/product-role-sql.test.ts
M	tests/admin/store-context.test.ts
A	tests/cadastro/cli.test.ts
A	tests/cadastro/executor.test.ts
A	tests/cadastro/pasta.test.ts
A	tests/cadastro/plano.test.ts
M	tests/content/product-queries.test.ts
M	tests/membros/architecture-theme.test.ts
M	tests/membros/content-image.test.ts
M	tests/membros/content-routes.test.ts
M	tests/membros/resource-open.test.ts
M	tests/membros/store-access.test.ts
A docs/validacao-cadastrador-produtos.md
```

Revisão independente final: P2 (normalização de sufixos de storage) e P3 (mensagens de filesystem) corrigidos em 06786aa e re-review aprovado. Checks integrados posteriores passaram; nenhum achado permanece aberto nesta entrega. Branch mantida localmente, sem merge/push/deploy.
