# Cadastrador de produtos Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Cadastrar produtos publicados por pasta e código Payt com validação integral, simulação e atualização idempotente.
**Architecture:** Planejador puro e leitor local separados do executor Supabase. role percorre banco, admin e vitrine.
**Tech Stack:** Next.js 16.3.5, Supabase JS, Node ESM, TypeScript, Vitest, PGlite.
**Spec:** docs/superpowers/specs/2026-09-24-cadastrador-produtos-design.md
**Execution:** O usuário delegou revisão/aprovação e pediu execução autônoma com subagentes e paralelismo quando possível.

## Global Constraints
- Não alterar scripts/cadastro-atlas-patologias.mjs.
- Não aplicar migration em produção, não cadastrar produtos reais, não fazer push nem deploy.
- Nunca imprimir nem commitar segredos do .env.local.
- products.role: front | orderbump | upsell; default front, not null, check.
- Todos os produtos publicados não comprados permanecem bloqueados e visíveis.
- Nenhum item ou módulo ausente da pasta será apagado.
- Bucket arquivos e caminhos <slug>/...; execução repetida atualiza sem duplicar.
- Ler node_modules/next/dist/docs/01-app/02-guides/forms.md antes de editar app.
- TDD: registrar RED e GREEN; commits pequenos apenas dos arquivos da tarefa.

## Review Focus
1. Lote com segunda pasta inválida não pode enviar primeira: teste subprocesso/cliente espião na tarefa 3.
2. Colisão após remoção de prefixos/normalização não pode sobrescrever entregáveis: testes na tarefa 2.
3. Oferta já usada não pode liberar outro produto inadvertidamente: fake estado e zero writes na tarefa 3.
4. Ordenação por trilhas não pode desfazer prioridade: teste buildTracks na tarefa 1.
5. Consulta com erro não pode virar insert; reexecução preserva extras: fake estado na tarefa 3.

### Task 1: Papel do produto de ponta a ponta
**Files:** migration supabase/migrations/20260924000003_product_role.sql; src/lib/domain/types.ts; src/lib/data/products.ts; src/lib/data/products-admin.ts; src/lib/admin/forms.ts; src/app/admin/(painel)/produtos/product-form.tsx; src/app/admin/(painel)/produtos/actions.ts somente se necessário; src/lib/access/access.ts; fixtures afetadas e tests/admin, tests/access, tests/content.
**Interfaces:** Produz ProductRole e Product.role obrigatórios; ShelfProduct.role opcional se necessário para compatibilidade dos consumidores antigos, default front. Não altera interface do cadastrador.
- [x] Escrever testes de role default front, rejeição inválida, persistência/admin action, SQL default/check/not-null, ordenação locked e tracks.
```ts
expect(buildShelf([front, upsell, orderbump], new Set()).locked.map(p => p.id))
  .toEqual([orderbump.id, upsell.id, front.id])
```
Fixtures: front sortOrder 0; upsell 4; orderbump 2. Adicionar comprado com sortOrder 1 e rascunho para garantir acesso/visibilidade preservados.
- [x] Rodar npm test -- tests/access tests/admin/forms.test.ts e registrar falhas esperadas.
- [x] Implementar migration:
```sql
alter table public.products add column role text not null default 'front'
  check (role in ('front','orderbump','upsell'));
```
Propagar campo por toProduct, saveProduct e parseProductForm; select Papel com Front/Orderbump/Upsell. Validar checkout para roles complementares coerente com ficha. Comparador locked usa prioridade {orderbump:0,upsell:0,front:1} seguido sortOrder; buildTracks usa prioridade só entre bloqueados. Manter destaque/comprados.
- [x] Rodar testes focados, typecheck se necessário, suite completa uma vez, salvar relatório RED/GREEN.
- [x] Commit feat: add product roles and prioritize complementary offers.

### Task 2: Planejador e leitura de pastas
**Files:** scripts/lib/cadastro-plano.mjs, scripts/lib/cadastro-pasta.mjs, tests/cadastro/plano.test.ts, tests/cadastro/pasta.test.ts.
**Interfaces:** exports gerarSlug(text), lerFicha(text,{defaultStoreSlug}={}), montarPlano({ficha,arquivos,linksTexto=''}) e lerPastaProduto(directory,{defaultStoreSlug}={}). Arquivos são {relativePath,absolutePath,size}; relativePath slash. lerPastaProduto retorna plano. Plano:
```js
{
 folder: '/absolute/path', ficha: {
 nome, id, tag, loja, slug, trilha:'', checkout:null, destaque:false, ordem:0, descricao:''
 },
 imagens: { capa: null, banner: null },
 modulos: [{title,sortOrder,itens:[{title,kind,sortOrder,url:null,arquivo:null}]}],
 arquivos: [{relativePath,absolutePath,size,storagePath,contentType,downloadName}]
}
```
Imagem/arquivo de item referencia um objeto de arquivos; links têm url e arquivo null. montarPlano pode omitir folder; leitor acrescenta folder. storagePath começa slug/. Todos erros em português.
- [x] Escrever testes parser válido/obrigatórios/tag/checkout/descrição multilinha/slug acentuado, BOM/CRLF/comentários, ordem inválida, URL perigosa. Plano: arquivos soltos, módulos numerados, ordenação prefixo e alfabética, YouTube/Vimeo/link, MIME e imagens.
```ts
expect(gerarSlug('Inspeção & Construção')).toBe('inspecao-construcao')
expect(() => lerFicha('nome: Kit\nid: ABC\ntag: upsell', {defaultStoreSlug:'arquitetura'})).toThrow(/checkout/i)
```
Adicionar colisões de título/storage, imagens ambíguas, diretórios profundos e symlinks rejeitados; testar leitor com arquivos temporários.
- [x] Rodar npm test -- tests/cadastro e registrar RED.
- [x] Implementar exports; usar normalize('NFD'), remoção de marcas e regex de slug. Validar todo input antes de plano pronto; MIME pdf/zip/jpg/jpeg/png/webp/mp4/doc/docx/xls/xlsx/ppt/pptx/txt/csv, fallback octet-stream. Leitor usa lstat/readdir e verifica leitura de todos arquivos antes de retorno.
- [x] Rodar testes focados e suite uma vez; registrar GREEN e interface final no relatório.
- [x] Commit feat: plan product registration from local folders.

### Task 3: Executor, CLI e guia
**Files:** scripts/cadastrar-produto.mjs; scripts/lib/cadastro-executor.mjs; tests/cadastro/executor.test.ts; tests/cadastro/cli.test.ts; docs/como-cadastrar-produto.md; docs/exemplo-pasta-produto/produto.txt, links.txt e estrutura de entregaveis documentada.
**Interfaces:** Consome plano da tarefa 2. Exports executarPlanos(db,planos,{log=console.log}={}) com preflight global, e CLI aceita pasta [--todos] [--simular]. Importar CLI não executa; execução direta via pathToFileURL.
- [x] Escrever fake cliente Supabase com registros persistentes. Testar duas execuções sem duplicatas; atualização de URLs/ordens/publicação; extras listados; colisão Payt/loja e mesmo storage slug outra loja recusadas antes de upload; erros de leitura propagados.
```ts
await executarPlanos(db, [plano], {log})
await executarPlanos(db, [plano], {log})
expect(db.rows.products).toHaveLength(1)
expect(db.rows.modules).toHaveLength(1)
expect(db.rows.items).toHaveLength(1)
```
CLI subprocesso testa --simular sem credenciais, --todos com pasta inválida, flags inválidas, ausência de pasta, resumo e link.
- [x] Rodar testes, registrar RED.
- [x] Implementar preflight de todos planos antes de qualquer write. Verificar coluna role/lojas/conflitos offers e storage slug. Não imprimir erro bruto com segredo. Consultas com error lançam erro claro. Upload upsert/contentType/getPublicUrl e downloadName com URL encoding; produtos por store_id+slug, módulos por title, itens por title, oferta por code e link. Atualizar is_published e ordens; não apagar extras.
- [x] CLI lê .env.local via parser nativo Node disponível (parseEnv) e process.env tem precedência. Simulação não instancia cliente nem faz rede. --todos lista ignoradas, valida todos antes de executar; mostra módulos/itens/tamanho/Payt/link, estados criado/atualizado.
- [x] Criar exemplo com comentários antes da descrição e links seguros de exemplo. Guia explica estrutura, pasta em aspas, --todos, --simular, limites, idempotência por título, conflitos, operação parcial recuperável e migration manual no SQL Editor.
- [x] Rodar testes e simulação do exemplo; registrar GREEN. Commit feat: register product folders with safe preflight.

### Task 4: Integração, frontend e validação final
**Files:** docs/validacao-cadastrador-produtos.md; ajustes descobertos em revisão com agente implementador.
**Interfaces:** Consome tarefas 1–3, nenhuma API nova.
- [x] Revisão independente por tarefa e revisão final do diff consolidado; corrigir findings e revisar fixes.
- [x] Rodar npm test, npm run lint, npm run build. Se junction node_modules impedir Turbopack, usar instalação isolada ou build webpack documentando causa e finalmente executar npm run build sem workaround se viável.
- [x] Agent-browser Vercel: abrir fixture local do ProductForm real com action stub e vitrine real com dados locais; testar select, defaults, opções, mobile/desktop e ordem bloqueados. Não bypass de auth no código de produção, não gravar Supabase remoto.
- [x] Simular docs/exemplo-pasta-produto e lote temporário, conferir resumo. Registrar evidências e screenshots locais.
- [x] Commit docs: record product registration validation. Entregar branch/localização, arquivos, testes, migration e comando simular. Não merge/push/deploy.
