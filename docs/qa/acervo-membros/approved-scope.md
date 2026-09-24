# Estado aprovado — 24/09/2026

Este documento substitui as propostas visuais anteriores. O usuário autorizou implementar somente o login e as telas de item aprovados, mantendo home e produto na apresentação original.

- Login: versão aprovada preservada.
- Item desktop/mobile: versão aprovada preservada, incluindo formatos, ajuda e progresso sincronizado.
- Home desktop/mobile: banner, categorias/carrosséis e cabeçalho originais.
- Produto: estrutura original de b1c8252, sem retomada, sem ajuda nova, sem disclosure externo do sumário e com cards/rótulos originais. Isso também remove o redesign desktop não incluído nas telas aprovadas.
- Cores de contraste do item isoladas para não modificar home/produto.
- Estado do modal bloqueado fora do escopo também restaurado.

Código da correção: 7463ca4. Revisão independente de requisitos/qualidade aprovada. Testes focados 40/40, ESLint dos arquivos alterados e TypeScript passaram. Suíte completa no worktree: 524 testes/72 arquivos; build de produção exit 0.

Vercel agent-browser com Next real e fixture local: login funcionou; home original conferida; produto original conferido a375/1440; item manteve sumário fechado no celular e aberto no desktop, ações PDF/ZIP e amarelo aprovado. Sem overflow a375 e sem erros JS listados. Capturas inspecionadas visualmente:

- [Produto mobile original](approved-product-original-mobile.png)
- [Produto desktop original](approved-product-original-desktop.png)
- [Item mobile aprovado](approved-item-mobile.png)

Sem publicação ou migration remota. A sincronização do progresso ainda requer a migration documentada em activation.md antes do deploy. Limitação de salvamento físico do download pelo agent-browser registrada no primeiro relatório permanece; esta correção não altera a rota de download. Os processos/sessão locais de QA foram encerrados.
