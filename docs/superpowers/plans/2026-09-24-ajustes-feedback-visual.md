# Ajustes conforme feedback visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Restaurar a home anterior em todas as telas e a apresentação anterior do produto mobile, preservando login e item aprovados.
**Architecture:** Reusar o layout anterior de b1c8252, com alterações responsivas delimitadas à página de produto. Nenhuma mudança de backend.
**Tech Stack:** Next 16.3.5, React, Tailwind, Vitest, agent-browser.
**Spec:** Feedback explícito do usuário nesta conversa: login aprovado; home anterior desktop/mobile; item desktop/mobile aprovado; produto mobile rejeitado. Interpretação conservadora: restaurar produto mobile anterior, manter desktop atual.

## Global Constraints
- Login e item devem permanecer visual e funcionalmente iguais à entrega 3533e62.
- Não modificar banco, autorização, progresso, dependências, deploy ou e-mails.
- Home deve retomar banner, categorias/carrosséis e Continuar de b1c8252. Restaurar o cabeçalho antigo SOMENTE na home se necessário, sem alterar cabeçalho de item/login.
- Mobile do produto significa viewport <1024px; desktop mantém composição atual.
- Restaurar produto mobile sem duplicar árvores de conteúdo inteiras, IDs ou consultas. Ajustes via props opcionais e CSS responsivo devem preservar defaults dos componentes usados pelo item.

## Review Focus
Isolamento entre página de produto/home e telas aprovadas; sem duplicação acessível no desktop; filtros de publicação e autorização preservados.

### Task 1: Aplicar reversão visual delimitada e validar
**Files:** src/app/[loja]/page.tsx; src/app/[loja]/produto/[slug]/page.tsx; src/components/membros/{store-header,lesson-sidebar,resource-list}.tsx apenas se necessário por props; testes correspondentes tests/membros/content-routes.test.ts e outros afetados.

- [x] Ler docs Next instalados relevantes antes de editar.
- [x] Restaurar home a partir de b1c8252; conferir mudanças compartilhadas do header sem afetar telas aprovadas. Remover expectativas da nova biblioteca da rota home nos testes, manter testes unitários dos componentes reaproveitáveis.
- [x] Produto mobile: recuperar rótulo Seu material, ação Abrir primeiro conteúdo para primeiro item, vídeos antes dos recursos, sumário ao final com módulos visíveis como na versão anterior. No mobile da página de produto, não exibir texto de ação extra comprimindo o título do recurso (acessibilidade e formato conhecido podem permanecer). Ajuda contextual pode permanecer ao final. Desktop continua retomada e recursos primeiro, sem sumário adicional.
- [x] Preferir um único conjunto de módulos com ordenação responsiva; quando existirem CTAs responsive, garantir apenas um visível por breakpoint. Defaults de Sidebar/ResourceList devem permanecer idênticos aos aprovados no item.
- [x] Testes focados; lint nos arquivos alterados; typecheck/build a cargo do controlador após QA. Não escrever testes que só copiem classes; focar renderização, destinos e isolamento de props quando necessário.
- [x] Self-review e commit somente arquivos próprios. Reportar arquivos, testes e decisões ao controlador.

Controlador fará revisão independente, QA via agent-browser a 375 e1440, teste completo/build e cópia delimitada ao checkout original após conferir hashes. Sem perguntas adicionais, conforme autonomia já solicitada.
