# Integração dos níveis com as entregas recentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Integrar o cadastrador e Básico/Completo à versão atual, preservando as telas aprovadas, progresso, cupom e suporte.
**Architecture:** Reutilizar os commits revisados de `codex/niveis-produtos` e integrar `main` (`cb065f6`) no worktree isolado. Resolver contratos compartilhados com união dos campos e autorização por nível também nas ações de progresso. Nenhuma nova proposta visual.
**Tech Stack:** Next 16.3.5, React 19, Supabase, Vitest/PGlite, agent-browser.
**Spec:** `docs/superpowers/specs/2026-09-24-niveis-produtos-design.md`, preservando também os comportamentos de `main` documentados em `docs/qa/acervo-membros/approved-scope.md` e `docs/superpowers/specs/2026-09-24-cupom-suporte-design.md`.

## Global Constraints

- Completo inclui Básico e extras; uma capa e produto; reembolso preserva outros pedidos pagos.
- Preservar login/item aprovados, progresso sincronizado, suporte, checkout de aluno e email aprovado presentes em main.
- Checkout de aluno com desconto e checkout de upgrade são campos distintos, sem inferir valores.
- Novos arquivos privados, links assinados após autorização e importador com preflight permanecem.
- Não publicar, enviar push, executar SQL remoto ou alterar catálogo real nesta solicitação de implementação.
- Preservar alterações não commitadas na pasta original; implementação no worktree já existente, branch `codex/integracao-niveis-produtos`.
- Ler a documentação local do Next antes de alterações em rotas/actions.
- Renumerar somente migration ainda não aplicada do recurso isolado; nunca renumerar progresso/cupom já publicados.

## Review Focus

1. Progresso de item extra deve negar Básico antes de escrita ou revalidação.
2. Mesmo prefixo de migration não pode identificar progresso e role simultaneamente.
3. Queries e formulários precisam manter `studentCheckoutUrl`, `upgradeCheckoutUrl` e `role` juntos.
4. Sidebar e progresso nunca devem reintroduzir links para extras bloqueados; item aprovado permanece visualmente intacto.
5. Fixture deve simular as novas tabelas/campos; falha do fake não deve ser confundida com falha do aplicativo.

### Task 1 — Integração e regressões

**Files:** arquivos conflitantes identificados pelo merge, `src/app/[loja]/progresso/actions.ts`, `tests/membros/member-progress-action.test.ts`, migrations de role e suas referências em testes/docs, `tests/content/product-queries.test.ts`, testes de formulários/rotas.
**Interfaces:** `loadGrantedProductLevels():Promise<Map<string,AccessLevel>>`, `canAccessLevel(granted,required)`, campos opcionais Product `studentCheckoutUrl`, `upgradeCheckoutUrl`, `role` coexistentes.

- [ ] Integrar main no worktree com `git merge --no-commit main`; resolver cada conflito com união dos comportamentos, sem escolher um lado inteiro.
- [ ] Manter campos de produto nas três camadas: seleção SQL, mapper e persistência/formulário.
```ts
studentCheckoutUrl: row.student_checkout_url ?? null,
upgradeCheckoutUrl: row.upgrade_checkout_url ?? null,
```
- [ ] Adicionar regressão de progresso: Básico não conclui nem desfaz conclusão de extra; Completo continua autorizado. Rodar teste e confirmar RED antes de corrigir a action.
```ts
const levels = await loadGrantedProductLevels(store.id, customer)
if (!canAccessLevel(levels.get(ctx.product.id), ctx.module.requiredLevel ?? 'basic')) {
  return { ok: false, error: 'Conteúdo indisponível.' }
}
```
Adaptar o texto ao erro existente para não expor conteúdo. Testar ausência de `setItemCompletion` e `revalidatePath` ao negar.
- [ ] Renomear `20260924000001_product_role.sql` para `20260924000003_product_role.sql`, atualizar suas referências e adicionar verificação de unicidade das versões de todas as migrations. Manter `20260924000001_member_progress.sql` e `20260924000002_student_checkout.sql` intactas.
- [ ] Rodar testes relevantes, TypeScript e depois a suíte completa. Conferir interface aprovada preservada nas rotas. Commit de integração e correções, reportar contagens e arquivos.

### Task 2 — Revisão da integração

**Files:** somente relatório ignorado de revisão; checkout em modo leitura.
- [ ] Comparar a integração contra `main` e contra a branch antiga: conferir fields, action, migrations e apresentação aprovada.
- [ ] Revisar permissões antes de progresso, conteúdo e assinatura. Conferir que o conflito de versões foi eliminado sem tocar migrations publicadas.
- [ ] Encaminhar achados concretos para correção e revisar somente os ajustes.

### Task 3 — QA e entrega

**Files:** fixture de `docs/qa/niveis-produtos/`, novo relatório `docs/qa/integracao-niveis/relatorio.md` e capturas; `docs/status-integracao-niveis-2026-09-24.md`.
- [ ] Adaptar a fixture às tabelas de progresso e campos recentes sem usar credenciais reais; bloquear fetch externo.
- [ ] Rodar `npm run build`, `npm test`, `npm run lint`; simular cadastro legado e com níveis.
- [ ] Usar `agent-browser@0.38.1` no build local: Basic/Complete, item com toolbar de progresso, navegação filtrada, cupom na vitrine de produto não comprado, ajuda e campos de admin. Desktop1440 e mobile390; capturas e ausência de overflow/erros.
- [ ] Registrar validação e ordem exata das migrations. Encerrar serviços locais.
- [ ] Entregar branch integrada localmente. Integração na pasta principal somente se não sobrescrever alterações locais; não fazer push/deploy.
