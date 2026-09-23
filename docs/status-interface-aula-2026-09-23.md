# Interface da aula e barra de ações

Implementado e integrado ao projeto principal, sem commit, push ou nova publicação.

## Interface

- Produto e aula usam conteúdo amplo à esquerda e painel de conteúdos à direita; em celular, ficam empilhados.
- Arquivos em cartões separados com botão circular e movimento sutil; links externos continuam abrindo em nova aba pela rota protegida.
- Identidade preservada por loja: Arquitetura usa grafite, laranja, amarelo e Barlow Condensed; outras lojas conservam seus tokens.
- Produto mantém visão geral e acesso direto aos materiais, com botão para abrir o primeiro conteúdo. Na aula, a barra inclui Sobre, Aula anterior, Próxima aula e Concluir.
- Sobre apresenta produto, módulo, aula e descrição. Fecha por botão, Escape ou clique externo, devolvendo o foco ao acionador em fechamento por teclado/botão.
- Conclusão reversível em localStorage, isolada por aluno, loja e item; mensagem explícita “Salvo neste navegador”. Não sincroniza entre dispositivos nem altera banco. Erros de armazenamento aparecem em português.

## Arquivos

- src/app/[loja]/architecture.css
- src/app/[loja]/item/[id]/page.tsx
- src/app/[loja]/produto/[slug]/page.tsx
- src/components/membros/resource-list.tsx
- src/components/membros/lesson-sidebar.tsx
- src/components/membros/lesson-toolbar.tsx
- tests/membros/content-image.test.ts
- tests/membros/content-routes.test.ts
- tests/membros/lesson-toolbar.test.ts

## RED / GREEN

O teste da nova barra foi escrito antes do componente. `npm test -- tests/membros/lesson-toolbar.test.ts` falhou inicialmente com import não resolvido, pois lesson-toolbar.tsx ainda não existia. Durante a implementação, o caso de falha do armazenamento também ficou vermelho porque exibia indevidamente “Salvo neste navegador”; o comportamento foi corrigido. Os sete testes da barra passaram depois, incluindo persistência, isolamento, navegação e fechamento acessível de Sobre.

O teste antigo de banner foi atualizado para a nova composição compacta; a cobertura própria de imagem eager/high foi preservada.

## Verificação final no projeto principal

- `npm test`: 60 arquivos e 479 testes passaram; saída 0.
- `npx tsc --noEmit`: sem erros; saída 0.
- `npm run lint`: zero erros, um aviso preexistente de variável loja não usada em scripts/trocar-admin-e-aluno.mjs:20:15; saída 0.
- `npm run build`: compilação, TypeScript e geração de páginas concluídos; saída 0.
- Os nove arquivos integrados foram conferidos por hash. Revisão independente aprovada.

## Navegador

Agent-browser 0.38.1 com Next real e fixture local de autenticação/REST/Storage: telas desktop 1440 px e mobile 390 px, ambas as identidades; nomes longos sem overflow horizontal; Sobre abre/fecha; próxima aula navega e conserva estado separado; Concluído persiste após reload. Link externo abriu nova aba mantendo a query. Cliques em arquivos chegaram à fixture pública com attachment=true. A gravação do PDF em disco pelo navegador automatizado não foi confirmada nesta rodada; uma alteração de configuração de download reiniciou a sessão, sem mudança no app. O fluxo de download já tinha sido validado com arquivo salvo na etapa anterior.

Axe no conteúdo principal: zero violações após corrigir contraste do botão concluído, botão padrão e rótulos. Itens inconclusivos de ícones e sobreposição foram inspecionados visualmente. Não foi feito teste autenticado nem upload em produção nesta alteração.

Preview local: .superpowers/ui-aula/aula-desktop.png.
