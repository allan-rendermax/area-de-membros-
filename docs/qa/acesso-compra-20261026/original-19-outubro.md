# Recuperação da apresentação original de 19/10/2026

Referência atual escolhida pelo usuário: restaurar a apresentação original de 19/10, sem redesenho, mantendo as proteções atuais e sem publicar antes da conferência. Este relatório substitui as prévias de 21/10 e as propostas de reorganização anteriores.

## Origem comprovada

- GitHub: `b56dc4c8cce9cd805820049c1c829abda25a1f32`.
- Vercel: `dpl_FXdTRvrWYQ4MF5ic56nBTshBSB5f`, produção READY; `https://area-de-membros-f0pkxylzr-rendermax.vercel.app`. Associação ao commit verificada por API somente leitura.
- Catálogo: `C:/Users/arqal/OneDrive/Desktop/Ideias Low Ticket/Area de membros/artifacts/atlas-update-2026-10-19/after.json`. SHA-256 `7476755a878ba5fa47f6b218a68c78d8a7f3a7eb897201caacd9e77e4df2d8ea`.
- Esse catálogo contém dois itens no Completo: Atlas e “Acesse seu bônus”. Os downloads individuais foram acrescentados em 25/10, por alteração de dados.

## Escopo recuperado

JSX, textos, classes e ordem de `item-content`, `lesson-sidebar`, `resource-list` e apresentação do produto vazio recuperados do commit original. O banner `pathology-upsell.tsx` e seu CSS são idênticos aos arquivos de 19/10. SHA-256 respectivos: `115908e7249549790ab28282f658e4cc076951ee56c80dc9c1c2a22dfd71937c` e `f255c872e4cb8011ba5d7b187927796134aaaffa131c3189760cff3042e96102`.

O banner “Você deixou isso passar no checkout.”, a navegação de conteúdos e o rótulo PDF pertencem à versão original e foram mantidos por fidelidade à solicitação mais recente. Nenhuma nova organização visual foi criada. O endereço público do grupo foi recuperado da migração de 16/10.

Preservados: homepage atual, autenticação, autorização por compra/nível, rotas protegidas de abertura, validadores, dependências corrigidas e carregamento atual. As diferenças permitidas no renderer são compatibilidade dos argumentos, propagação de cenário de teste e abertura segura em nova aba (`noopener noreferrer` e descrição acessível).

## Prévia e limites

URL: `http://127.0.0.1:3180/arquitetura/produto/atlas-visual-das-patologias-na-construcao-civil-completo`.

O backend local usa os campos de apresentação do produto e os metadados dos itens do snapshot real de 19/10. Contas, compras e destinos dos materiais são simulados. Não houve restauração nem alteração do banco de produção. As capturas abaixo foram feitas agora com o código recuperado; não são fotografias históricas. A captura histórica disponível de 21/10 não foi apresentada como sendo de 19/10.

## Validação

- Revisão independente confirmou fidelidade dos componentes ao commit histórico, inclusive o ramo de produto vazio.
- 325 testes em 48 arquivos aprovados; TypeScript, ESLint dos arquivos alterados e `git diff --check` aprovados após a última edição de código.
- Vercel agent-browser: 1440, 918 e 390 pixels; dois materiais, banner original, grupo WhatsApp, ausência dos quatro downloads individuais e dos novos cartões complementares, sem overflow e sem erros JavaScript registrados.
- Cliques no Atlas e no bônus abriram os destinos locais de teste em novas abas pelas rotas protegidas.
- Requisição sem sessão à rota de abertura retornou 307 para `/arquitetura/entrar`.

Evidências: `original-19-outubro/browser.json`, `previa-1440.png`, `previa-918.png` e `previa-390.png`. Scripts locais: `.superpowers/prepare-oct19-exact-fixture.mjs` e `.superpowers/check-oct19-exact-preview.mjs`.

**Não publicado. Produção e catálogo real permanecem sem alterações nesta recuperação.**
