# Arquitetura Design System Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan in the current session.

**Goal:** Aplicar a direção energética aprovada apenas à área /arquitetura.
**Architecture:** Provider de tema no layout da loja; CSS restrito ao atributo do tema; valores globais originais como fallback. Arte local opcional por slug de produto, preservando imagens cadastradas.
**Tech Stack:** Next 16.3.5, React 19, Tailwind 4, Vitest e imagens WebP.
**Spec:** docs/design-system-arquitetura.md

## Global Constraints

- Exclusivo ao slug exato arquitetura. Outras lojas e admin preservados.
- Não alterar autenticação, pagamentos, conteúdo, banco ou permissões.
- Pôster 2:3; banner 21:9 desktop / 16:9 mobile; item 16:9.
- Respeitar arte cadastrada e redução de movimento; foco e contraste legíveis.

## Review Focus

1. Portais fora do layout devem herdar o tema sem alterar o body.
2. Navegação para outras lojas não pode reter cores de arquitetura.
3. Imagem cadastrada e produtos desconhecidos devem manter comportamento válido.
4. Texto comprido e tela 375px não podem encobrir ação ou produzir overflow.
5. Produtos bloqueados continuam bloqueados; acervo não recebe dados fictícios.

## Task 1 — Tema e arte isolados

- [x] Testar resolução exata e prioridade de imagens em tests/membros/architecture-theme.test.ts.
- [x] Executar teste vermelho, implementar src/lib/membros/theme.ts, rodar verde.
- [x] Criar provider em src/components/membros/member-theme.tsx e transportar contexto em modal.tsx.
- [x] Testar isolamento de provider/portal em tests/membros/member-theme.test.ts.

Interface: getMemberTheme(slug): 'arquitetura' | undefined; withMemberArtwork<T extends Product>(product: T, storeSlug: string): T.

## Task 2 — Aplicação visual

- [x] Preservar defaults em globals.css usando var(--member-*, fallback).
- [x] Criar CSS restrito ao tema, hero de arquitetura e capas automáticas.
- [x] Aplicar provider no layout; imagens nos produtos e vitrine; tema em login, header e modais.
- [x] Preparar 3 artes WebP e documentação de origem.
- [x] Manter hrefs e dados reais; validar build e testes existentes.

## Task 3 — Verificação e entrega

- [x] Rodar suite, lint, TypeScript e build.
- [x] Inspecionar início, login, produto e modal em desktop/mobile com fixture local.
- [x] Revisão independente do isolamento e regressões.
- [x] Integrar a alteração testada ao workspace principal e entregar o design system e preview. Publicação é etapa separada.
