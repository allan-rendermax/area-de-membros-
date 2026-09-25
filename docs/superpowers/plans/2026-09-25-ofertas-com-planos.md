# Ofertas com planos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Cadastrar uma oferta com vários planos Payt e liberações Básico/Completo por produto.

**Architecture:** Adicionar offer_groups e relacionar offers existentes como planos; manter intactos códigos e relações consumidos pelo webhook/acesso. Salvar o grupo inteiro por uma RPC transacional, usando versão para detectar edição desatualizada. Usar um formulário cliente com useActionState e ações autenticadas por loja.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, Supabase/PostgreSQL, Vitest, PGlite, happy-dom.

**Spec:** docs/superpowers/specs/2026-09-25-ofertas-com-planos-design.md

## Global Constraints
- Os únicos níveis de liberação são basic e complete; nomes de planos são livres.
- Preservar IDs, códigos Payt, compras e liberações existentes.
- Validar loja e pertencimento do plano ao grupo no servidor e na transação.
- Toda falha desfaz o salvamento completo; formulários conservam os dados digitados.
- Ler documentação Next instalada antes de editar componentes/actions.
- Executar localmente na branch codex/ofertas-com-planos; preservar trabalho não relacionado já presente no checkout.
- Pedido explícito de implementação permite seguir diretamente após registrar este plano.

## Review Focus
- Códigos duplicados no formulário e em outro grupo precisam falhar sem gravação parcial (Tarefa 1).
- Plano de outra loja/grupo não pode ser transferido pelo envio de seu UUID (Tarefa 1).
- Plano com pedido cancelado, reembolsado, teste ou sem loja também não pode ser removido (Tarefa 1).
- Duas abas: a segunda gravação com versão antiga deve falhar e manter sua edição na tela (Tarefas 1 e 3).
- Salvar Básico/Completo/Combo não pode alterar como pedidos anteriores concedem acesso (Tarefas 1 e 3).

### Task 1: Persistência transacional e migração

**Files:** Create supabase/migrations/20260925030000_offer_groups.sql; tests/admin/offer-groups-sql.test.ts.

**Interfaces:** Produces offer_groups(id uuid, store_id uuid, name text, version integer), offers.group_id uuid; save_offer_group_atomic(p_id uuid, p_store_id uuid, p_name text, p_version integer, p_plans jsonb) returns uuid; delete_offer_group_atomic(p_id uuid,p_store_id uuid,p_confirmation text) returns void. Cada plano JSON contém id nullable, name, payt_product_code, grants[{product_id,grant_level}].

- [x] Escrever testes PGlite que carregam migrações reais e fixtures de Atlas Básico/Completo com códigos preservados. Asserção central:
```ts
expect((await db.query('select count(*)::int as n from offer_groups')).rows).toEqual([{ n: 1 }])
await expect(save(db, [{ ...basic, payt_product_code: 'DUP' }, { ...complete, payt_product_code: 'DUP' }])).rejects.toThrow()
expect((await db.query('select count(*)::int as n from offers')).rows).toEqual([{ n: 2 }])
```
- [x] Executar `npm test -- tests/admin/offer-groups-sql.test.ts`; esperar falha porque a migração ainda não existe.
- [x] Criar tabela com RLS, chave composta para conferir loja, backfill por conjunto de produtos e trigger de compatibilidade para INSERT antigo sem group_id. Usar RPC existente save_offer_levels_atomic para validar e substituir liberações. Validar IDs distintos, códigos sem espaço, nomes preenchidos, array não vazio, versão e pertencimento antes de editar. Atualizar/inserir todos os planos e só então remover os omitidos usando delete_offer_atomic. Excluir grupo usando a mesma proteção de pedidos. RPCs security invoker e execute somente service_role.
```sql
select * into v_group from public.offer_groups where id = p_id and store_id = p_store_id for update;
if v_group.version is distinct from p_version then
  raise exception 'Esta oferta foi alterada. Recarregue a página antes de salvar.';
end if;
```
- [x] Cobrir todos os cinco pontos de revisão; executar o teste novamente, esperar todos verdes.

### Task 2: Contratos do formulário, dados e ações

**Files:** Create src/lib/admin/offer-groups.ts; src/lib/data/offer-groups.ts; src/app/admin/(painel)/ofertas/group-actions.ts; tests/admin/offer-groups.test.ts; tests/admin/offer-group-actions.test.ts. Modify src/lib/data/products-admin.ts (nome contextual na seleção manual).

**Interfaces:** Produces OfferPlanInput, OfferGroupInput, parseOfferGroupForm(form, storeId), AdminOfferGroup{id,name,version,plans}, listOfferGroups(storeId), getOfferGroup(id,storeId), saveOfferGroup(input), deleteOfferGroup(input), salvarGrupoOferta(previous,form), excluirGrupoOferta(previous,form).

- [x] Escrever validação real com nomes e códigos trimados; recusar JSON inválido, arrays vazios, IDs repetidos, códigos repetidos, produtos duplicados e níveis fora de basic/complete.
```ts
expect(parseOfferGroupForm(form, store).plans[0].grants).toEqual([{ productId: product, level: 'basic' }])
expect(() => parseOfferGroupForm(invalidLevelForm, store)).toThrow(/nível/i)
```
- [x] Executar `npm test -- tests/admin/offer-groups.test.ts tests/admin/offer-group-actions.test.ts`; esperar falhas das funções ausentes.
- [x] Implementar parser tipado e transformação para a RPC. Autenticar todas as ações, comparar store_id enviado com loja atual, retornar mensagens sem redirect em erro e revalidar admin/membros em sucesso; redirect para grupo salvo após sucesso.
```ts
await requireAdmin()
const store = await getAdminStore()
assertAdminStoreContext(form, store.id)
const id = await saveOfferGroup(parseOfferGroupForm(form, store.id))
```
- [x] Consultar grupos e planos em uma relação Supabase; resolver URLs antigas por offers.group_id. Listagem manual usa nome do grupo + nome do plano. Testar erro de migração ausente e duplicidade global.
- [x] Executar os testes da tarefa e esperar todos verdes.

### Task 3: Cadastro único, listagem e verificação

**Files:** Create src/app/admin/(painel)/ofertas/offer-group-form.tsx; src/app/admin/(painel)/ofertas/delete-group-form.tsx; tests/admin/offer-group-form.test.ts; docs/ofertas-com-planos.md. Modify src/app/admin/(painel)/ofertas/page.tsx; src/app/admin/(painel)/ofertas/[id]/page.tsx; src/app/admin/(painel)/ofertas/delete-offer-form.tsx (reutilizar confirmação).

**Interfaces:** Consumes AdminOfferGroup e ações da Tarefa 2. Produces OfferGroupForm({offer,products,initialCode,storeId}) e confirmação de exclusão do grupo.

- [x] Escrever testes happy-dom de adicionar, renomear e remover plano novo; seleção independente de produtos/níveis; códigos salvos readonly; IDs/versão preservados; erro de servidor conservando dados e envio bloqueado enquanto pendente.
```ts
await act(async () => button('Adicionar plano').click())
expect(container.querySelectorAll('[data-plan]')).toHaveLength(3)
```
- [x] Executar `npm test -- tests/admin/offer-group-form.test.ts`; esperar falha do componente ausente.
- [x] Formulário controlado com planos estáveis, inputs acessíveis e JSON oculto. Inicializar dois planos Básico/Completo (ou um quando vier código pendente), sem selecionar produtos implicitamente. Permitir remover com confirmação local; transação protege compradores. Campo de cada produto: Não liberar, Básico, Completo. Usar useActionState e fieldset disabled durante envio.
```tsx
<input type="hidden" name="plans" value={JSON.stringify(plans)} />
<button type="button" onClick={addPlan}>Adicionar plano</button>
```
- [x] Atualizar listagem para grupos com seus planos, códigos e liberações; página de edição carrega grupo e redireciona IDs antigos. Reutilizar confirmação de exclusão existente passando ação do grupo, sem mudar comportamento legado.
- [x] Documentar cadastro, migração aditiva, política de códigos e bloqueio de exclusão com pedidos.
- [x] Executar `npm test`, `npx eslint src tests`, `npm run build`; esperar zero falhas. Revisão independente final via subagente, conforme executing-plans, com foco em autorização, migração e regressões de acesso.
- [x] Registrar resultados, revisar diff e commitar somente arquivos desta funcionalidade.

## Registro da execução

- Execução nativa autorizada pelo pedido explícito de implementação, usando branch local `codex/ofertas-com-planos`; alterações preexistentes em docs/assets preservadas.
- Tarefa 1: completa. Testes PGlite executaram a migração real: RED por migração ausente, GREEN após implementação. Migração aditiva mantém códigos, IDs e níveis.
- Tarefa 2: completa. Parser, persistência e ações autenticadas: RED por funções ausentes, GREEN com validações e isolamento de loja.
- Tarefa 3: completa. Formulário interativo, agrupamento, redirecionamento legado, exclusão e documentação implementados. Testes happy-dom validam planos e níveis independentes, bloqueio durante envio e retenção dos dados em erros.
- Revisão independente: um P2 encontrado — chamadas legadas alteravam os planos sem atualizar a versão do grupo. Corrigido com triggers em offers/offer_products e lock NOWAIT; dois testes reproduziram a falha antes da correção e passaram depois. Nenhum outro achado ou item adiado.
- Verificação adicional do fluxo de erro: teste RED→GREEN para restaurar plano removido quando houver bloqueio de exclusão, sem perder o restante do preenchimento.
- Verificação final: `npm test` passou (884 testes, 111 arquivos); `npx eslint src tests` passou; `npm run build` passou, incluindo TypeScript. Aviso informativo preexistente do Vite sobre configuração CommonJS.
- Migração e publicação de produção não executadas nesta tarefa; procedimento em `docs/ofertas-com-planos.md`.
