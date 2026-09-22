# Preparação para lançamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Corrigir falhas verificadas e entregar uma versão testada com pendências de produção explícitas.
**Architecture:** Mudanças incrementais em quatro unidades. Contratos entre persistência e webhook usam campos já existentes; RPCs administrativas novas exigem migração antes de publicação.
**Tech Stack:** Next.js 16.3.5, React 19, Supabase, Resend, TypeScript, Vitest/PGlite.
**Spec:** docs/superpowers/specs/2026-09-22-prontidao-lancamento-design.md

## Global Constraints
- Preservar cores, tipografia, carrosséis, login só e-mail e riscos aceitos.
- Não alterar .env.local, dados remotos ou enviar e-mails reais.
- Não aplicar migrações nem publicar código dependente antes da aplicação manual.
- Sem cache persistente de permissões e sem dependência nova de produção.
- TDD: registrar falha relevante antes da implementação e teste passando depois.
- Cada agente altera só seus arquivos e não faz commit concorrente; controller coordena commits.

## Review Focus
- Formulário antigo após troca de loja em outra aba: nenhuma escrita/envio.
- Titular corrigido e payload pago atrasado: destinatário efetivo preservado.
- Falha no meio da edição de oferta: acesso anterior intacto.
- Falha após alteração Auth: dados de cliente e pedidos não ficam divididos.
- Conteúdo longo, tela baixa e teclado: fechar e CTA alcançáveis.

### Task 1: Contexto explícito de loja nos formulários
**Files:** src/lib/admin/current-store.ts; src/app/admin/(painel)/produtos/{actions.ts,product-form.tsx,[id]/page.tsx}; ofertas/{actions.ts,offer-form.tsx,[id]/page.tsx}; clientes/{actions.ts,[id]/page.tsx}; tests/admin/store-context.test.ts.
**Interfaces:** consumir getAdminStore(); produzir assertAdminStoreContext(form:FormData, storeId:string):void ou helper equivalente puro. ProductForm e OfferForm recebem storeId:string. Nenhuma dependência de Task 4.
- [x] Escrever regressões das ações com mocks dos limites de IO e FormData:
```ts
form.set('store_id', storeA)
currentStore = storeB
await expect(salvarProduto(form)).rejects.toThrow(/NEXT_REDIRECT/)
expect(saveProduct).not.toHaveBeenCalled()
```
Cobrir criação produto/oferta, reenvio/liberação/revogação manual, id ausente, loja válida. Formulários renderizados incluem store_id.
- [x] Rodar npm test -- tests/admin/store-context.test.ts e observar RED.
- [x] Incluir hidden store_id, validar antes de uploads/escritas/envio dentro do tratamento de erro amigável. Para mudança de contexto usar mensagem “A loja foi alterada em outra aba. Recarregue a página antes de salvar.” sem redirecionar silenciosamente ou gravar em loja errada.
- [x] Rodar testes focados e tsc; salvar relatório task-1-report.md. Não mudar persistência.
- [x] Controller revisa e commita.

### Task 2: Destinatário efetivo do pedido
**Files:** src/lib/orders/process-postback.ts; src/lib/data/postback-repo.ts; tests/helpers/fakes.ts; tests/orders/{process-postback.test.ts,postback-repo.test.ts}.
**Interfaces:** ampliar resultado interno de applyOrderStatus com customerEmail:string e customerName:string; RPC mantém assinatura e retorno antigos, adapter faz SELECT por out_order_id em orders. Status efetivo deve vir da mesma leitura persistida.
- [x] Regressões: pagamento A, correção para B, aviso antigo A só notifica B e não recria A; linhas de titulares distintos não misturam produtos; falha SELECT não envia e deixa retry; pendente/pago preserva regra SQL existente; zero produtos publicados produz emailErrors/event.error explícito, sem declarar liberação bem-sucedida.
```ts
await processPostback(oldPayload, deps)
expect(notify).toHaveBeenCalledWith(expect.objectContaining({to: 'corrigido@example.test'}))
expect(repo.customers.has('antigo@example.test')).toBe(false)
```
- [x] Observar RED com npm test -- tests/orders.
- [x] Ler orders id/customer_email/customer_name/status; agrupar notificações por identidade efetiva e loja. Manter productIds para cobertura de avisos e failed notices; reembolso não envia. Não implementar reserva ou deduplicação externa neste task.
- [x] Validar suite orders/email/access, relatar limitações; task-2-report.md.
- [x] Controller revisa e commita.

### Task 3: Diálogos acessíveis e recuperação de navegação
**Files:** src/components/membros/{locked-poster.tsx,install-app-button.tsx,modal.tsx}; src/app/{error.tsx,not-found.tsx}; tests/membros/{locked-poster.test.ts,modal.test.ts,install-app.test.ts}.
**Interfaces:** criar primitive Modal com open, onClose, labelledBy e children (ou contrato equivalente simples), portal document.body, foco e scroll. Consumidores preservam callbacks e URL existente.
- [x] Reproduzir no browser antes/depois e acrescentar testes comportamentais do lifecycle/teclado:
```ts
// abrir -> primeiro controle; Tab no último -> primeiro;
// Shift+Tab primeiro -> último; Escape chama onClose; fechar restaura foco.
// Desmontar restaura scroll, sem listeners pendentes.
```
Usar harness existente ou DOM leve disponível; nenhuma nova dependência de produção. Teste de retorno de foco precisa refletir acionador real. Manter testes reabertura via comprar.
- [x] Observar RED focado; ler guia local Next de error handling.
- [x] Dialog portal com z-index apropriado, max-height 90dvh e overflow-y-auto. Fechar por backdrop somente quando target=currentTarget; preservar visual curto. Instalar iPhone deve cobrir viewport fora de header blur. Adicionar erro/404 em português com navegação de recuperação, sem expor error.message; reset usa API desta versão Next.
- [x] Testes focados; task-3-report.md com instruções específicas para QA agent-browser.
- [x] Controller revisa e commita.

### Task 4: Persistência administrativa indivisível
**Files:** supabase/migrations/20260922210000_admin_atomic_mutations.sql; src/lib/data/{products-admin.ts,customers.ts}; src/lib/admin/forms.ts; tests/admin/{offer-persistence.test.ts,customer-email.test.ts,atomic-mutations-sql.test.ts,forms.test.ts}.
**Interfaces:** public.save_offer_atomic(p_id uuid,p_store_id uuid,p_name text,p_product_code text,p_product_ids uuid[]) returns uuid. public.change_customer_email_atomic(p_id uuid,p_expected_email text,p_new_email text) returns void. Chamadas RPC pelo service_role; não alterar assinaturas existentes de saveOffer/changeCustomerEmail.
- [x] Testes PGlite para rollback e seleção inteira de oferta, propriedade de loja, código imutável, FK, acesso de roles e e-mail esperado; mocks das etapas Auth/RPC com falha e compensação.
```ts
await expect(saveOffer({...input, productIds: []})).rejects.toThrow()
await expect(changeCustomerEmail(id, nextEmail)).rejects.toThrow()
expect(authUpdate).toHaveBeenLastCalledWith(id, {email: previousEmail, email_confirm: true})
```
- [x] Rodar focados e observar RED.
- [x] SQL: bloquear linha offers FOR UPDATE antes de editar; validar todos ids pertencem à loja e seleção não vazia (duplicates normalizados); delete+insert em transação; novo registro também indivisível. Banco garante rollback em erro. Função de e-mail bloqueia customer, compara expected_email e atualiza orders+customers juntos; unicidade do e-mail continua constraint. SECURITY INVOKER, search_path fixo, revoke public/anon/authenticated e grant service_role.
- [x] Cliente: saveOffer chama RPC (mensagem clara se migração ausente, sem fallback não atômico). changeCustomerEmail valida cliente/destino, atualiza Auth via SDK; chama RPC; se falha reverte Auth ao email anterior. Se falha compensação, emitir erro explícito pedindo repetir correção/reconciliação; nunca sucesso falso. Não tocar auth.users diretamente. Concorrência distribuída Auth não deve ser anunciada como resolvida integralmente.
- [x] Testes GREEN; task-4-report.md inclui ordem migração antes de deploy e limitações.
- [x] Controller revisa e commita; código NÃO será publicado antes do SQL.

## Validação integrada e encerramento
- [x] npm test; npx tsc --noEmit; npm run lint; npm run build com ambiente sintético no worktree.
- [x] agent-browser da Vercel: reprodução e confirmação desktop/mobile, aluno e admin, falhas e 404. Fixture HTTP/Auth sintético fora do repo, nenhuma entrega de email.
- [x] Revisão final independente do diff.
- [x] docs/status-lancamento-2026-09-22.md: comandos/resultados, achados corrigidos, riscos aceitos/pendentes, duas migrações, necessidade de compra/bump/reembolso reais e limite dos testes.
- [x] Commit local. Manter branch revisável sem publicar devido à migração pendente confirmada.
