# Produtos selecionáveis nos planos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Mostrar apenas produtos adicionados a cada plano, com produto pesquisável, Básico/Completo, adição e remoção de linhas.

**Architecture:** Manter o contrato de `plans` e as ações de persistência. O formulário controla linhas com chaves estáveis; um componente local controla o menu pesquisável. Nenhuma migração ou dependência nova.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, Tailwind, Vitest e happy-dom.

**Spec:** Layout aprovado nesta conversa em 26/09/2026: colunas PRODUTO e PLANO; produto em menu suspenso com busca; nível Básico/Completo; + Adicionar produto e ×; edição mostra apenas liberações existentes.

## Global Constraints

- Preservar IDs, versão, códigos Payt, ações de salvar e acessos existentes.
- Preservar a separação entre planos da oferta e níveis de acesso dos produtos.
- Não alterar trabalhos anteriores presentes no checkout.
- Executar diretamente nesta sessão conforme pedido de implementação; entregar alterações locais verificadas.

## Review Focus

- Catálogo de 60 produtos: só as linhas adicionadas aparecem; busca encontra títulos com acentos.
- Produto repetido: não permitir duas linhas do mesmo produto dentro do plano; permitir em planos distintos.
- Linha vazia: bloquear salvamento e orientar a seleção, sem conceder produto automaticamente.
- Edição, remoção e troca: preservar níveis e os outros produtos, inclusive após erro de salvamento.
- Teclado e ausência de produtos: setas/Enter/Escape/Tab funcionam; catálogo vazio orienta cadastrar produtos.

### Task 1: Seletor pesquisável e integração ao formulário

**Files:** (relativos a `C:/Users/arqal/OneDrive/Desktop/Ideias Low Ticket/Area de membros`)
- Create: `src/app/admin/(painel)/ofertas/product-select.tsx`
- Modify: `src/app/admin/(painel)/ofertas/offer-group-form.tsx`
- Test: `tests/admin/offer-group-form.test.ts`

**Interfaces:**
- Consumes: `Product[]`, `OfferPlanInput`, `AdminOfferGroup` e `salvarGrupoOferta` existentes.
- Produces: `ProductSelect({ products, value, onChange, label })`, com `products: Product[]`, `value: string`, `onChange: (id: string) => void`, `label: string`.
- Payload preservado: `grants: Array<{ productId: string; level: 'basic' | 'complete' }>`.

- [x] Adaptar testes de interação e acrescentar casos dos cinco itens de Review Focus. Assert principal de catálogo grande:
```ts
expect(container.querySelectorAll('[data-grant]')).toHaveLength(1)
expect(plans()[0].grants).toEqual([{ productId: 'product-1', level: 'basic' }])
```
- [x] Executar `npm test -- tests/admin/offer-group-form.test.ts`. Expected: falha porque o formulário atual ainda não tem combobox nem linhas adicionáveis.
- [x] Criar combobox com `useId`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, busca sem distinguir acentos, lista com altura limitada e opções clicáveis/selecionáveis por teclado. Validar que uma seleção real é obrigatória.
- [x] Trocar `products.map` por linhas `plan.grants.map`, dar chave estável a cada linha e adicionar/remover/trocar sem alterar o nível. Excluir produtos já escolhidos das opções das outras linhas.
```ts
const grants = plan.grants.map(({ productId, level }) => ({ productId, level }))
```
- [x] Executar o teste novamente. Expected: todos os casos passam, incluindo edição e erro de salvamento.

### Task 2: Documentação, regressões e revisão

**Files:**
- Modify: `docs/ofertas-com-planos.md`

**Interfaces:** Sem alterações adicionais de contrato.

- [x] Atualizar as instruções para adicionar linha, buscar produto, escolher nível e remover linha.
- [x] Executar `npm test`, `npm run lint` e `npx tsc --noEmit`. Expected: sucesso; registrar eventuais falhas preexistentes com precisão.
- [x] Revisar diff e cenários de catálogo grande, teclado, linhas vazias e edição. Corrigir defeitos encontrados e repetir apenas checks afetados.
- [x] Registrar resultados neste plano e entregar o resumo, distinguindo implementação local de publicação.

## Execution record

- Plano conferido com o layout aprovado. O pedido explícito para implementar autoriza a execução sem nova etapa de aprovação.

- Task 1 concluída: seletor pesquisável, linhas adicionáveis/removíveis, níveis e payload preservados. Testes inicialmente 8 falhas/4 acertos; versão final 13/13 casos do formulário passaram.
- Task 2 concluída: documentação atualizada; suíte completa final 111 arquivos e 890 testes aprovados; TypeScript sem erros; ESLint dos arquivos alterados sem avisos ou erros.
- Lint global: 0 erros e 189 avisos em arquivos preexistentes. `git diff --check` dos arquivos alterados passou; o check global identificou apenas uma linha vazia preexistente em docs/status-cupom-suporte-2026-09-24.md.
- Revisão independente dos quatro arquivos não encontrou defeitos confirmados e indicou conferir a validação nativa no navegador.
- Ruling: a validação considera productId, não o texto temporário da busca. Teste de regressão falhou antes da correção e passou depois. O estado transitório do menu reinicia ao salvar para não reabrir após erro; outro teste reproduziu e confirmou a correção.
- Navegador: prévia local com os componentes reais e catálogo fictício de 60 produtos; ação de salvar substituída por retorno local. Confirmados busca sem acentos, teclado, bloqueio de linha vazia, níveis independentes e retorno após envio. Screenshot em oferta-produtos-desktop.png. Servidor temporário encerrado.
- Alterações mantidas localmente no projeto Area de membros. Sem publicação, migração, alteração de dados reais ou modificação dos trabalhos anteriores.