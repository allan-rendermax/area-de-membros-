# Ajustes após feedback visual — 24/09/2026

Esta revisão substitui a proposta de home e produto mobile apresentada no relatório anterior.

- **Home desktop/mobile:** restaurados banner, carrosséis por categoria, seção Continuar e cabeçalho anterior. A busca e os cards de acessos recentes da proposta rejeitada deixaram de aparecer na home.
- **Produto mobile:** restaurados rótulo Seu material, botão Abrir primeiro conteúdo, vídeos antes dos downloads e sumário ao final com módulos abertos. Os downloads voltaram ao card compacto com ícone, mantendo formato conhecido e nome acessível.
- **Produto desktop:** mantidos retomada, recursos primeiro e lista sem sumário adicional.
- **Login e item desktop/mobile:** preservados; novas opções dos componentes compartilhados são usadas somente nas páginas ajustadas.

A interpretação de restaurar o produto mobile anterior foi escolhida como continuação conservadora do feedback, conforme autonomia já solicitada. Caso a preferência fosse uma terceira proposta, o custo é apenas uma nova revisão visual reversível. Nenhuma publicação ou mudança de banco nesta etapa.

## Validação

- Revisão independente de requisitos e qualidade: aprovada, sem achados concretos.
- 26 testes de rotas e lint dos 6 arquivos alterados passaram.
- Suíte completa no worktree: **524 testes em 72 arquivos passaram**.
- Build de produção: **exit 0**, incluindo TypeScript.
- Vercel agent-browser em Next real com fixture local: home a 375/1440px, âncora Explorar meus materiais, produto nos dois breakpoints e item aprovado. Sem erros JavaScript listados; 375px sem overflow horizontal.
- Conferidos sumário fechado no item mobile e aberto no desktop, rótulos de download do item preservados e sumário do produto invisível no desktop.
- Login e rota de item não foram editados nesta revisão; defaults dos componentes compartilhados foram mantidos.

## Capturas atuais

- [Home desktop](feedback-home-desktop.png)
- [Home mobile](feedback-home-mobile.png)
- [Produto mobile](feedback-product-mobile.png)
- [Produto desktop](feedback-product-desktop.png)
- [Item mobile preservado](feedback-item-mobile-preserved.png)

O relatório browser-report.md descreve a primeira entrega e seus limites de download/migration; as telas atuais de home/produto são as deste documento. Processos de QA locais encerrados após a conferência.
